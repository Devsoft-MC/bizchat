import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../lib/async-handler.js';
import { AppError, notFound } from '../lib/errors.js';
import { createRoomToken } from '../lib/livekit.js';
import { sendPushNotifications } from '../lib/push-notifications.js';
import { authenticate } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';

const createCallSchema = z.object({
  conversationId: z.string().uuid(),
  participantId: z.string().uuid(),
  callType: z.enum(['audio', 'video'])
});

const callIdSchema = z.object({ callId: z.string().uuid() });
const respondSchema = z.object({ action: z.enum(['accept', 'decline', 'busy']) });
const endSchema = z.object({ reason: z.enum(['completed', 'cancelled', 'failed', 'unanswered']).default('completed') });

async function withTransaction(db, callback) {
  if (!db.connect) return callback(db);
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

function emitCallUpdate(request, userIds, event, call) {
  const io = request.app.get('io');
  if (!io) return;
  userIds.forEach((userId) => io.to(`user:${userId}`).emit(event, call));
}

async function getCallForUser(db, callId, companyId, userId) {
  const result = await db.query(
    `SELECT c.id, c.company_id, c.conversation_id, c.created_by, c.call_type, c.status,
            c.room_name, c.started_at, c.ended_at, c.end_reason, c.created_at,
            cp.status AS participant_status,
            creator.first_name AS caller_first_name, creator.last_name AS caller_last_name,
            ARRAY_AGG(all_cp.user_id) AS participant_ids
     FROM calls c
     JOIN call_participants cp ON cp.call_id = c.id AND cp.user_id = $3
     JOIN call_participants all_cp ON all_cp.call_id = c.id
     JOIN users creator ON creator.id = c.created_by
     WHERE c.id = $1 AND c.company_id = $2
     GROUP BY c.id, cp.status, creator.first_name, creator.last_name`,
    [callId, companyId, userId]
  );
  return result.rows[0] ?? null;
}

export function createCallsRouter(db) {
  const router = Router();
  router.use(authenticate);

  router.get('/incoming', asyncHandler(async (request, response) => {
    const result = await db.query(
      `SELECT c.id, c.conversation_id, c.created_by, c.call_type, c.status, c.created_at,
              creator.first_name AS caller_first_name, creator.last_name AS caller_last_name
       FROM calls c
       JOIN call_participants cp ON cp.call_id = c.id
       JOIN users creator ON creator.id = c.created_by
       WHERE c.company_id = $1 AND cp.user_id = $2
         AND cp.status = 'invited' AND c.status = 'ringing'
       ORDER BY c.created_at DESC
       LIMIT 1`,
      [request.auth.companyId, request.auth.sub]
    );
    response.json({ call: result.rows[0] ?? null });
  }));

  router.get('/history', asyncHandler(async (request, response) => {
    const result = await db.query(
      `SELECT c.id, c.conversation_id, c.created_by, c.call_type, c.status,
              c.started_at, c.ended_at, c.end_reason, c.created_at,
              cp.status AS participant_status,
              creator.first_name AS caller_first_name, creator.last_name AS caller_last_name
       FROM calls c
       JOIN call_participants cp ON cp.call_id = c.id AND cp.user_id = $2
       JOIN users creator ON creator.id = c.created_by
       WHERE c.company_id = $1
       ORDER BY c.created_at DESC
       LIMIT 50`,
      [request.auth.companyId, request.auth.sub]
    );
    response.json({ calls: result.rows });
  }));

  router.get('/:callId', validate(callIdSchema, 'params'), asyncHandler(async (request, response) => {
    const call = await getCallForUser(db, request.params.callId, request.auth.companyId, request.auth.sub);
    if (!call) throw notFound('Call not found');
    response.json({ call });
  }));

  router.post('/', validate(createCallSchema), asyncHandler(async (request, response) => {
    const { conversationId, participantId, callType } = request.body;
    if (participantId === request.auth.sub) throw new AppError(400, 'invalid_participant', 'You cannot call yourself');

    const call = await withTransaction(db, async (client) => {
      const membership = await client.query(
        `SELECT c.id, target.first_name, target.last_name
         FROM conversations c
         JOIN conversation_members caller_member ON caller_member.conversation_id = c.id
           AND caller_member.user_id = $3 AND caller_member.left_at IS NULL
         JOIN conversation_members target_member ON target_member.conversation_id = c.id
           AND target_member.user_id = $4 AND target_member.left_at IS NULL
         JOIN users target ON target.id = target_member.user_id
           AND target.company_id = c.company_id AND target.status = 'active'
         WHERE c.id = $1 AND c.company_id = $2 AND c.conversation_type = 'direct'`,
        [conversationId, request.auth.companyId, request.auth.sub, participantId]
      );
      if (!membership.rows[0]) throw notFound('Direct conversation not found');

      const existing = await client.query(
        `SELECT c.id
         FROM calls c
         JOIN call_participants caller_cp ON caller_cp.call_id = c.id AND caller_cp.user_id = $2
         JOIN call_participants target_cp ON target_cp.call_id = c.id AND target_cp.user_id = $3
         WHERE c.company_id = $1 AND c.status IN ('ringing', 'ongoing')
         LIMIT 1`,
        [request.auth.companyId, request.auth.sub, participantId]
      );
      if (existing.rows[0]) throw new AppError(409, 'call_in_progress', 'A call is already in progress between these users');

      const roomName = `bizchat-${request.auth.companyId}-${randomUUID()}`;
      const created = await client.query(
        `INSERT INTO calls (company_id, conversation_id, created_by, call_type, status, room_name)
         VALUES ($1, $2, $3, $4, 'ringing', $5)
         RETURNING id, company_id, conversation_id, created_by, call_type, status, room_name, started_at, ended_at, end_reason, created_at`,
        [request.auth.companyId, conversationId, request.auth.sub, callType, roomName]
      );
      const nextCall = created.rows[0];
      await client.query(
        `INSERT INTO call_participants (call_id, user_id, status, joined_at, is_camera_on)
         VALUES ($1, $2, 'accepted', now(), $4), ($1, $3, 'invited', NULL, false)`,
        [nextCall.id, request.auth.sub, participantId, callType === 'video']
      );
      await client.query(
        `INSERT INTO call_events (call_id, user_id, event_type, metadata)
         VALUES ($1, $2, 'created', jsonb_build_object('call_type', $3::text)),
                ($1, $4, 'ringing', '{}'::jsonb)`,
        [nextCall.id, request.auth.sub, callType, participantId]
      );
      return { ...nextCall, participant_ids: [request.auth.sub, participantId] };
    });

    emitCallUpdate(request, call.participant_ids, 'call:incoming', call);
    db.query(
      `SELECT u.first_name, u.last_name,
              COALESCE(ARRAY_AGG(d.push_token) FILTER (WHERE d.push_token IS NOT NULL AND d.status = 'active'), '{}') AS push_tokens
       FROM users u
       LEFT JOIN user_devices d ON d.user_id = $2 AND d.company_id = $1
       WHERE u.id = $3 AND u.company_id = $1
       GROUP BY u.id`,
      [request.auth.companyId, participantId, request.auth.sub]
    ).then(({ rows }) => {
      const caller = rows[0];
      if (!caller) return;
      const callerName = [caller.first_name, caller.last_name].filter(Boolean).join(' ');
      return sendPushNotifications(caller.push_tokens || [], {
        title: `Incoming ${callType} call`, body: `${callerName} is calling`
      }, { type: 'incoming_call', callId: call.id, callType });
    }).catch((error) => console.error('Call push notification failed', error));

    response.status(201).json({ call });
  }));

  router.post('/:callId/respond', validate(callIdSchema, 'params'), validate(respondSchema), asyncHandler(async (request, response) => {
    const { callId } = request.params;
    const { action } = request.body;
    const participantStatus = action === 'accept' ? 'accepted' : action === 'busy' ? 'busy' : 'declined';
    const callStatus = action === 'accept' ? 'ongoing' : action === 'busy' ? 'cancelled' : 'declined';

    const updated = await db.query(
      `WITH participant AS (
         UPDATE call_participants cp
         SET status = $4, joined_at = CASE WHEN $4 = 'accepted' THEN now() ELSE joined_at END
         FROM calls c
         WHERE cp.call_id = c.id AND c.id = $1 AND c.company_id = $2
           AND cp.user_id = $3 AND cp.status = 'invited' AND c.status = 'ringing'
         RETURNING cp.call_id
       )
       UPDATE calls c
       SET status = $5,
           started_at = CASE WHEN $5 = 'ongoing' THEN COALESCE(started_at, now()) ELSE started_at END,
           ended_at = CASE WHEN $5 <> 'ongoing' THEN now() ELSE ended_at END,
           end_reason = CASE WHEN $5 = 'declined' THEN 'declined' WHEN $4 = 'busy' THEN 'busy' ELSE end_reason END,
           updated_at = now()
       FROM participant p
       WHERE c.id = p.call_id
       RETURNING c.id`,
      [callId, request.auth.companyId, request.auth.sub, participantStatus, callStatus]
    );
    if (!updated.rows[0]) throw notFound('Ringing call not found');

    await db.query(
      `INSERT INTO call_events (call_id, user_id, event_type) VALUES ($1, $2, $3)`,
      [callId, request.auth.sub, action === 'accept' ? 'accepted' : action === 'busy' ? 'busy' : 'declined']
    );
    const call = await getCallForUser(db, callId, request.auth.companyId, request.auth.sub);
    emitCallUpdate(request, call.participant_ids, 'call:updated', call);
    response.json({ call });
  }));

  router.post('/:callId/token', validate(callIdSchema, 'params'), asyncHandler(async (request, response) => {
    const call = await getCallForUser(db, request.params.callId, request.auth.companyId, request.auth.sub);
    if (!call || !['ringing', 'ongoing'].includes(call.status) || call.participant_status !== 'accepted') {
      throw notFound('Active call not found');
    }
    const user = await db.query(
      `SELECT first_name, last_name FROM users WHERE id = $1 AND company_id = $2 AND status = 'active'`,
      [request.auth.sub, request.auth.companyId]
    );
    if (!user.rows[0]) throw notFound('Active user not found');
    const displayName = [user.rows[0].first_name, user.rows[0].last_name].filter(Boolean).join(' ');
    const credentials = await createRoomToken({ roomName: call.room_name, userId: request.auth.sub, displayName });
    response.json({ call, livekit: credentials });
  }));

  router.post('/:callId/end', validate(callIdSchema, 'params'), validate(endSchema), asyncHandler(async (request, response) => {
    const result = await db.query(
      `UPDATE calls c
       SET status = CASE WHEN status = 'ringing' THEN 'cancelled' ELSE 'ended' END,
           ended_at = now(), ended_by = $3, end_reason = $4, updated_at = now()
       FROM call_participants cp
       WHERE c.id = $1 AND c.company_id = $2 AND cp.call_id = c.id AND cp.user_id = $3
         AND c.status IN ('ringing', 'ongoing')
       RETURNING c.id`,
      [request.params.callId, request.auth.companyId, request.auth.sub, request.body.reason]
    );
    if (!result.rows[0]) throw notFound('Active call not found');
    await db.query(
      `INSERT INTO call_events (call_id, user_id, event_type, metadata)
       VALUES ($1, $2, 'ended', jsonb_build_object('reason', $3))`,
      [request.params.callId, request.auth.sub, request.body.reason]
    );
    const call = await getCallForUser(db, request.params.callId, request.auth.companyId, request.auth.sub);
    emitCallUpdate(request, call.participant_ids, 'call:updated', call);
    response.json({ call });
  }));

  return router;
}
