import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../lib/async-handler.js';
import { AppError, notFound } from '../lib/errors.js';
import { authenticate } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';

const idParamsSchema = z.object({ id: z.string().uuid() });
const directSchema = z.object({ participantId: z.string().uuid() });
const messageSchema = z.object({ content: z.string().trim().min(1).max(4000) });

async function requireMembership(db, conversationId, auth) {
  const result = await db.query(
    `SELECT c.id
     FROM conversations c
     JOIN conversation_members cm ON cm.conversation_id = c.id
     WHERE c.id = $1 AND c.company_id = $2 AND cm.user_id = $3
       AND cm.left_at IS NULL AND c.is_archived = false`,
    [conversationId, auth.companyId, auth.sub]
  );
  if (!result.rows[0]) throw notFound('Conversation not found');
}

export function createConversationsRouter(db) {
  const router = Router();
  router.use(authenticate);

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
              u.first_name AS sender_first_name, u.last_name AS sender_last_name
       FROM messages m
       JOIN users u ON u.id = m.sender_id
       WHERE m.conversation_id = $1 AND m.company_id = $2 AND m.deleted_at IS NULL
       ORDER BY m.created_at ASC
       LIMIT 200`,
      [request.params.id, request.auth.companyId]
    );
    response.json({ messages: result.rows });
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
