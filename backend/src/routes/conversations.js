import { Router } from 'express';
import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import { asyncHandler } from '../lib/async-handler.js';
import { AppError, notFound } from '../lib/errors.js';
import { authenticate } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';

const idParamsSchema = z.object({ id: z.string().uuid() });
const directSchema = z.object({ participantId: z.string().uuid() });
const messageSchema = z.object({ content: z.string().trim().min(1).max(4000) });
const MAX_FILE_BYTES = 10 * 1024 * 1024;
const uploadDirectory = process.env.CHAT_UPLOAD_DIR || path.resolve(process.cwd(), 'uploads/chat');
const allowedMimeTypes = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain',
  'text/csv'
]);

function safeFileName(value) {
  return path.basename(value || 'attachment').replace(/[^a-zA-Z0-9._ -]/g, '_').slice(0, 180) || 'attachment';
}

function isAllowedMimeType(mimeType) {
  return mimeType.startsWith('image/') || allowedMimeTypes.has(mimeType);
}

async function parseMultipartFile(request) {
  const contentType = request.headers['content-type'] || '';
  const boundaryMatch = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/i);
  if (!boundaryMatch) throw new AppError(400, 'invalid_upload', 'A multipart file upload is required');
  const boundary = boundaryMatch[1] || boundaryMatch[2];
  const chunks = [];
  let totalBytes = 0;
  for await (const chunk of request) {
    totalBytes += chunk.length;
    if (totalBytes > MAX_FILE_BYTES + 64 * 1024) throw new AppError(413, 'file_too_large', 'Files must be 10 MB or smaller');
    chunks.push(chunk);
  }
  const body = Buffer.concat(chunks);
  const headerEnd = body.indexOf(Buffer.from('\r\n\r\n'));
  if (headerEnd < 0) throw new AppError(400, 'invalid_upload', 'The uploaded file could not be read');
  const headers = body.subarray(0, headerEnd).toString('utf8');
  const fileNameMatch = headers.match(/filename="([^"]*)"/i);
  const mimeTypeMatch = headers.match(/content-type:\s*([^\r\n]+)/i);
  const endMarker = Buffer.from(`\r\n--${boundary}`);
  const fileStart = headerEnd + 4;
  const fileEnd = body.indexOf(endMarker, fileStart);
  if (!fileNameMatch || fileEnd < fileStart) throw new AppError(400, 'invalid_upload', 'Choose one file to upload');
  const data = body.subarray(fileStart, fileEnd);
  const mimeType = (mimeTypeMatch?.[1] || 'application/octet-stream').trim().toLowerCase();
  if (!data.length) throw new AppError(400, 'empty_file', 'The selected file is empty');
  if (data.length > MAX_FILE_BYTES) throw new AppError(413, 'file_too_large', 'Files must be 10 MB or smaller');
  if (!isAllowedMimeType(mimeType)) throw new AppError(400, 'unsupported_file_type', 'Upload an image, PDF, text, Word, or Excel file');
  return { data, fileName: safeFileName(fileNameMatch[1]), mimeType };
}

async function requireMembership(db, conversationId, auth) {
  const result = await db.query(
    `SELECT c.id
     FROM conversations c
     JOIN conversation_members requester
       ON requester.conversation_id = c.id
      AND requester.user_id = $3
      AND requester.left_at IS NULL
     WHERE c.id = $1 AND c.company_id = $2
       AND c.conversation_type = 'direct' AND c.is_archived = false
       AND (SELECT count(*)
            FROM conversation_members recipient_scope
            WHERE recipient_scope.conversation_id = c.id
              AND recipient_scope.left_at IS NULL) = 2`,
    [conversationId, auth.companyId, auth.sub]
  );
  if (!result.rows[0]) throw notFound('Conversation not found');
}

export function createConversationsRouter(db) {
  const router = Router();
  router.use(authenticate);

  router.get('/', asyncHandler(async (request, response) => {
    const result = await db.query(
      `SELECT c.id, c.last_message_at, c.created_at,
              other_user.id AS participant_id,
              other_user.first_name AS participant_first_name,
              other_user.last_name AS participant_last_name,
              other_user.job_title AS participant_job_title,
              other_user.profile_photo_url AS participant_profile_photo_url,
              last_message.id AS last_message_id,
              last_message.sender_id AS last_message_sender_id,
              last_message.message_type AS last_message_type,
              last_message.content AS last_message_content,
              (SELECT count(*)::int
               FROM messages unread_message
               JOIN message_statuses unread_status
                 ON unread_status.message_id = unread_message.id
                AND unread_status.user_id = $2
               WHERE unread_message.conversation_id = c.id
                 AND unread_message.sender_id <> $2
                 AND unread_message.deleted_at IS NULL
                 AND unread_status.status <> 'read') AS unread_count
       FROM conversations c
       JOIN conversation_members requester
         ON requester.conversation_id = c.id AND requester.user_id = $2 AND requester.left_at IS NULL
       JOIN conversation_members other_member
         ON other_member.conversation_id = c.id AND other_member.user_id <> $2 AND other_member.left_at IS NULL
       JOIN users other_user ON other_user.id = other_member.user_id AND other_user.company_id = $1
       LEFT JOIN messages last_message ON last_message.id = c.last_message_id AND last_message.deleted_at IS NULL
       WHERE c.company_id = $1 AND c.conversation_type = 'direct' AND c.is_archived = false
         AND (SELECT count(*) FROM conversation_members recipient_scope
              WHERE recipient_scope.conversation_id = c.id AND recipient_scope.left_at IS NULL) = 2
       ORDER BY c.last_message_at DESC NULLS LAST, c.created_at DESC`,
      [request.auth.companyId, request.auth.sub]
    );
    response.json({ conversations: result.rows });
  }));

  router.post('/direct', validate(directSchema), asyncHandler(async (request, response) => {
    if (request.body.participantId === request.auth.sub) {
      throw new AppError(400, 'self_conversation', 'You cannot start a direct chat with yourself');
    }

    const client = await db.connect();
    try {
      await client.query('BEGIN');
      const participant = await client.query(
        `SELECT id, first_name, last_name, job_title, profile_photo_url
         FROM users WHERE id = $1 AND company_id = $2 AND status = 'active'`,
        [request.body.participantId, request.auth.companyId]
      );
      if (!participant.rows[0]) throw notFound('Colleague not found');

      const pair = [request.auth.sub, request.body.participantId].sort();
      await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`${request.auth.companyId}:${pair.join(':')}`]);
      let conversation = await client.query(
        `SELECT c.id, c.created_at, c.last_message_at
         FROM conversations c
         JOIN conversation_members first_member ON first_member.conversation_id = c.id AND first_member.user_id = $1 AND first_member.left_at IS NULL
         JOIN conversation_members second_member ON second_member.conversation_id = c.id AND second_member.user_id = $2 AND second_member.left_at IS NULL
         WHERE c.company_id = $3 AND c.conversation_type = 'direct' AND c.is_archived = false
           AND (SELECT count(*) FROM conversation_members cm WHERE cm.conversation_id = c.id AND cm.left_at IS NULL) = 2
         LIMIT 1`,
        [pair[0], pair[1], request.auth.companyId]
      );

      if (!conversation.rows[0]) {
        conversation = await client.query(
          `INSERT INTO conversations (company_id, conversation_type, created_by)
           VALUES ($1, 'direct', $2)
           RETURNING id, created_at, last_message_at`,
          [request.auth.companyId, request.auth.sub]
        );
        await client.query(
          `INSERT INTO conversation_members (conversation_id, user_id)
           VALUES ($1, $2), ($1, $3)`,
          [conversation.rows[0].id, pair[0], pair[1]]
        );
      }

      await client.query('COMMIT');
      response.json({ conversation: { ...conversation.rows[0], participant: participant.rows[0] } });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }));

  router.get('/:id/messages', validate(idParamsSchema, 'params'), asyncHandler(async (request, response) => {
    await requireMembership(db, request.params.id, request.auth);
    const result = await db.query(
      `SELECT m.id, m.conversation_id, m.sender_id, m.message_type, m.content,
              m.edited_at, m.created_at,
              u.first_name AS sender_first_name, u.last_name AS sender_last_name,
              COALESCE(jsonb_agg(jsonb_build_object(
                'id', a.id, 'file_name', a.file_name, 'mime_type', a.mime_type, 'file_size', a.file_size
              )) FILTER (WHERE a.id IS NOT NULL), '[]'::jsonb) AS attachments
       FROM messages m
       JOIN users u ON u.id = m.sender_id
       LEFT JOIN attachments a ON a.message_id = m.id
       WHERE m.conversation_id = $1 AND m.company_id = $2 AND m.deleted_at IS NULL
       GROUP BY m.id, u.id
       ORDER BY m.created_at ASC
       LIMIT 200`,
      [request.params.id, request.auth.companyId]
    );
    response.json({ messages: result.rows });
  }));

  router.post('/:id/read', validate(idParamsSchema, 'params'), asyncHandler(async (request, response) => {
    await requireMembership(db, request.params.id, request.auth);
    const result = await db.query(
      `UPDATE message_statuses status
       SET status = 'read', updated_at = now()
       FROM messages message
       WHERE status.message_id = message.id
         AND message.conversation_id = $1
         AND message.company_id = $2
         AND status.user_id = $3
         AND message.sender_id <> $3
         AND status.status <> 'read'
       RETURNING status.id`,
      [request.params.id, request.auth.companyId, request.auth.sub]
    );
    response.json({ readCount: result.rows.length });
  }));

  router.post('/:id/attachments', validate(idParamsSchema, 'params'), asyncHandler(async (request, response) => {
    await requireMembership(db, request.params.id, request.auth);
    const upload = await parseMultipartFile(request);
    await mkdir(uploadDirectory, { recursive: true });
    const extension = path.extname(upload.fileName).slice(0, 12);
    const storedName = `${randomUUID()}${extension}`;
    const storedPath = path.join(uploadDirectory, storedName);
    await writeFile(storedPath, upload.data, { flag: 'wx' });

    const client = await db.connect();
    try {
      await client.query('BEGIN');
      const messageResult = await client.query(
        `INSERT INTO messages (company_id, conversation_id, sender_id, message_type)
         VALUES ($1, $2, $3, $4)
         RETURNING id, conversation_id, sender_id, message_type, content, edited_at, created_at`,
        [request.auth.companyId, request.params.id, request.auth.sub, upload.mimeType.startsWith('image/') ? 'image' : 'file']
      );
      const message = messageResult.rows[0];
      const attachmentResult = await client.query(
        `INSERT INTO attachments
          (company_id, message_id, file_name, file_path, file_type, mime_type, file_size, checksum, uploaded_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING id, file_name, mime_type, file_size`,
        [request.auth.companyId, message.id, upload.fileName, storedName,
          upload.mimeType.startsWith('image/') ? 'image' : 'file', upload.mimeType,
          upload.data.length, createHash('sha256').update(upload.data).digest('hex'), request.auth.sub]
      );
      await client.query(
        `UPDATE conversations SET last_message_id = $1, last_message_at = $2, updated_at = now()
         WHERE id = $3 AND company_id = $4`,
        [message.id, message.created_at, request.params.id, request.auth.companyId]
      );
      await client.query(
        `INSERT INTO message_statuses (message_id, user_id, status)
         SELECT $1, cm.user_id, CASE WHEN cm.user_id = $2 THEN 'sent' ELSE 'delivered' END
         FROM conversation_members cm
         WHERE cm.conversation_id = $3 AND cm.left_at IS NULL`,
        [message.id, request.auth.sub, request.params.id]
      );
      await client.query('COMMIT');
      response.status(201).json({ message: { ...message, attachments: attachmentResult.rows } });
    } catch (error) {
      await client.query('ROLLBACK');
      await unlink(storedPath).catch(() => {});
      throw error;
    } finally {
      client.release();
    }
  }));

  router.get('/:id/attachments/:attachmentId', validate(z.object({ id: z.string().uuid(), attachmentId: z.string().uuid() }), 'params'), asyncHandler(async (request, response) => {
    await requireMembership(db, request.params.id, request.auth);
    const result = await db.query(
      `SELECT a.id, a.file_name, a.file_path, a.mime_type
       FROM attachments a
       JOIN messages m ON m.id = a.message_id
       WHERE a.id = $1 AND m.conversation_id = $2 AND a.company_id = $3 AND m.deleted_at IS NULL`,
      [request.params.attachmentId, request.params.id, request.auth.companyId]
    );
    const attachment = result.rows[0];
    if (!attachment) throw notFound('Attachment not found');
    const filePath = path.join(uploadDirectory, path.basename(attachment.file_path));
    const file = await readFile(filePath).catch(() => null);
    if (!file) throw notFound('Attachment file not found');
    await db.query('UPDATE attachments SET download_count = download_count + 1 WHERE id = $1', [attachment.id]);
    response.setHeader('Content-Type', attachment.mime_type || 'application/octet-stream');
    response.setHeader('Content-Disposition', `attachment; filename="${safeFileName(attachment.file_name)}"`);
    response.send(file);
  }));

  router.post('/:id/messages', validate(idParamsSchema, 'params'), validate(messageSchema), asyncHandler(async (request, response) => {
    await requireMembership(db, request.params.id, request.auth);
    const client = await db.connect();
    try {
      await client.query('BEGIN');
      const result = await client.query(
        `INSERT INTO messages (company_id, conversation_id, sender_id, content)
         VALUES ($1, $2, $3, $4)
         RETURNING id, conversation_id, sender_id, message_type, content, edited_at, created_at`,
        [request.auth.companyId, request.params.id, request.auth.sub, request.body.content]
      );
      const message = result.rows[0];
      await client.query(
        `UPDATE conversations SET last_message_id = $1, last_message_at = $2, updated_at = now()
         WHERE id = $3 AND company_id = $4`,
        [message.id, message.created_at, request.params.id, request.auth.companyId]
      );
      await client.query(
        `INSERT INTO message_statuses (message_id, user_id, status)
         SELECT $1, cm.user_id, CASE WHEN cm.user_id = $2 THEN 'sent' ELSE 'delivered' END
         FROM conversation_members cm
         WHERE cm.conversation_id = $3 AND cm.left_at IS NULL`,
        [message.id, request.auth.sub, request.params.id]
      );
      await client.query('COMMIT');
      response.status(201).json({ message });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }));

  return router;
}
