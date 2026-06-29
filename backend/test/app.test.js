import assert from 'node:assert/strict';
import { rm } from 'node:fs/promises';
import test from 'node:test';
import jwt from 'jsonwebtoken';
import request from 'supertest';

process.env.NODE_ENV = 'test';
process.env.DATABASE_URL ??= 'postgresql://localhost:5432/bizchat_local';
process.env.JWT_SECRET ??= 'test_secret_at_least_16_chars';
process.env.CHAT_UPLOAD_DIR ??= '/tmp/bizchat-test-uploads';

const { createApp } = await import('../src/app.js');
const { env } = await import('../src/config/env.js');
const { createRoomToken } = await import('../src/lib/livekit.js');
const { normalizeMobileNumber } = await import('../src/lib/phone-number.js');

function fakeDb(query = async () => ({ rows: [] })) {
  return { query };
}

test('mobile numbers are normalized to international format', () => {
  assert.equal(normalizeMobileNumber('+966 53 654 7919'), '+966536547919');
  assert.equal(normalizeMobileNumber('0091-98765-43210'), '+919876543210');
});

test('GET /api/health reports service health', async () => {
  const response = await request(createApp(fakeDb())).get('/api/health');
  assert.equal(response.status, 200);
  assert.equal(response.body.status, 'ok');
  assert.equal(response.body.service, 'bizchat-api');
});

test('GET /api/health/ready checks the database', async () => {
  const response = await request(createApp(fakeDb())).get('/api/health/ready');
  assert.equal(response.status, 200);
  assert.equal(response.body.database, 'connected');
});

test('POST /api/auth/login validates input', async () => {
  const response = await request(createApp(fakeDb())).post('/api/auth/login').send({});
  assert.equal(response.status, 400);
  assert.equal(response.body.error.code, 'validation_error');
});

test('protected routes require a bearer token', async () => {
  const response = await request(createApp(fakeDb())).get('/api/companies/current');
  assert.equal(response.status, 401);
  assert.equal(response.body.error.code, 'authentication_required');
});

test('company data is scoped to the company in the token', async () => {
  const companyId = '9ed485e6-054f-4c3f-8d98-0b0f55662d72';
  const token = jwt.sign({ sub: 'user-id', companyId, role: 'user' }, env.JWT_SECRET);
  let queryValues;
  const db = fakeDb(async (_sql, values) => {
    queryValues = values;
    return { rows: [{ id: companyId, name: 'Test Company' }] };
  });
  const response = await request(createApp(db))
    .get('/api/companies/current')
    .set('Authorization', `Bearer ${token}`);

  assert.equal(response.status, 200);
  assert.deepEqual(queryValues, [companyId]);
});

test('direct-chat messages are hidden from users who are not recipients', async () => {
  const companyId = '9ed485e6-054f-4c3f-8d98-0b0f55662d72';
  const outsiderId = '6975b187-ad72-42df-bb73-85ea968c5722';
  const conversationId = '27a87832-8c4f-4971-843a-a92de1149263';
  const token = jwt.sign({ sub: outsiderId, companyId, role: 'company_admin' }, env.JWT_SECRET);
  let messageQueryReached = false;
  const db = fakeDb(async (sql, values) => {
    if (sql.includes('FROM messages')) messageQueryReached = true;
    assert.deepEqual(values, [conversationId, companyId, outsiderId]);
    return { rows: [] };
  });

  const response = await request(createApp(db))
    .get(`/api/conversations/${conversationId}/messages`)
    .set('Authorization', `Bearer ${token}`);

  assert.equal(response.status, 404);
  assert.equal(response.body.error.code, 'not_found');
  assert.equal(messageQueryReached, false);
});

test('conversation recipients can upload a private attachment', async () => {
  const companyId = '9ed485e6-054f-4c3f-8d98-0b0f55662d72';
  const userId = '6975b187-ad72-42df-bb73-85ea968c5722';
  const conversationId = '27a87832-8c4f-4971-843a-a92de1149263';
  const messageId = '004c8766-31f7-42bd-8c4a-5c7542019f0b';
  const attachmentId = '55ac614f-a519-4755-93d1-5d5e638c1d38';
  const token = jwt.sign({ sub: userId, companyId, role: 'user' }, env.JWT_SECRET);
  const client = {
    async query(sql) {
      if (sql.includes('INSERT INTO messages')) return { rows: [{ id: messageId, conversation_id: conversationId, sender_id: userId, message_type: 'file', content: null, edited_at: null, created_at: new Date().toISOString() }] };
      if (sql.includes('INSERT INTO attachments')) return { rows: [{ id: attachmentId, file_name: 'hello.txt', mime_type: 'text/plain', file_size: 5 }] };
      return { rows: [] };
    },
    release() {},
  };
  const db = {
    async query() { return { rows: [{ id: conversationId }] }; },
    async connect() { return client; },
  };

  try {
    const response = await request(createApp(db))
      .post(`/api/conversations/${conversationId}/attachments`)
      .set('Authorization', `Bearer ${token}`)
      .attach('file', Buffer.from('hello'), { filename: 'hello.txt', contentType: 'text/plain' });

    assert.equal(response.status, 201);
    assert.equal(response.body.message.attachments[0].file_name, 'hello.txt');
  } finally {
    await rm(process.env.CHAT_UPLOAD_DIR, { recursive: true, force: true });
  }
});

test('conversation recipients can send a private voice message', async () => {
  const companyId = '9ed485e6-054f-4c3f-8d98-0b0f55662d72';
  const userId = '6975b187-ad72-42df-bb73-85ea968c5722';
  const conversationId = '27a87832-8c4f-4971-843a-a92de1149263';
  const messageId = '004c8766-31f7-42bd-8c4a-5c7542019f0b';
  const attachmentId = '55ac614f-a519-4755-93d1-5d5e638c1d38';
  const token = jwt.sign({ sub: userId, companyId, role: 'user' }, env.JWT_SECRET);
  let messageValues;
  let attachmentValues;
  const client = {
    async query(sql, values) {
      if (sql.includes('INSERT INTO messages')) {
        messageValues = values;
        return { rows: [{ id: messageId, conversation_id: conversationId, sender_id: userId, message_type: 'audio', content: null, edited_at: null, created_at: new Date().toISOString() }] };
      }
      if (sql.includes('INSERT INTO attachments')) {
        attachmentValues = values;
        return { rows: [{ id: attachmentId, file_name: 'voice-message.m4a', mime_type: 'audio/mp4', file_size: 5 }] };
      }
      return { rows: [] };
    },
    release() {},
  };
  const db = {
    async query() { return { rows: [{ id: conversationId }] }; },
    async connect() { return client; },
  };

  try {
    const response = await request(createApp(db))
      .post(`/api/conversations/${conversationId}/attachments`)
      .set('Authorization', `Bearer ${token}`)
      .attach('file', Buffer.from('voice'), { filename: 'voice-message.m4a', contentType: 'audio/mp4' });

    assert.equal(response.status, 201);
    assert.equal(response.body.message.message_type, 'audio');
    assert.equal(response.body.message.attachments[0].mime_type, 'audio/mp4');
    assert.equal(messageValues[3], 'audio');
    assert.equal(attachmentValues[4], 'audio');
  } finally {
    await rm(process.env.CHAT_UPLOAD_DIR, { recursive: true, force: true });
  }
});

test('mark-read updates only the signed-in recipient conversation state', async () => {
  const companyId = '9ed485e6-054f-4c3f-8d98-0b0f55662d72';
  const userId = '6975b187-ad72-42df-bb73-85ea968c5722';
  const conversationId = '27a87832-8c4f-4971-843a-a92de1149263';
  const token = jwt.sign({ sub: userId, companyId, role: 'user' }, env.JWT_SECRET);
  let updateValues;
  let queryNumber = 0;
  const db = fakeDb(async (_sql, values) => {
    queryNumber += 1;
    if (queryNumber === 1) return { rows: [{ id: conversationId }] };
    updateValues = values;
    return { rows: [{ id: 'status-1' }, { id: 'status-2' }] };
  });

  const response = await request(createApp(db))
    .post(`/api/conversations/${conversationId}/read`)
    .set('Authorization', `Bearer ${token}`);

  assert.equal(response.status, 200);
  assert.equal(response.body.readCount, 2);
  assert.deepEqual(updateValues, [conversationId, companyId, userId]);
});

test('authenticated users can register a push token for their device', async () => {
  const companyId = '9ed485e6-054f-4c3f-8d98-0b0f55662d72';
  const userId = '6975b187-ad72-42df-bb73-85ea968c5722';
  const token = jwt.sign({ sub: userId, companyId, role: 'user' }, env.JWT_SECRET);
  let insertValues;
  const db = fakeDb(async (sql, values) => {
    if (sql.startsWith('UPDATE user_devices')) return { rows: [] };
    insertValues = values;
    return { rows: [{ id: 'device-1', device_type: 'android', device_name: 'Pixel', status: 'active', last_active_at: new Date().toISOString() }] };
  });

  const response = await request(createApp(db))
    .post('/api/devices/push-token')
    .set('Authorization', `Bearer ${token}`)
    .send({ pushToken: 'fcm-token-with-enough-characters', deviceType: 'android', deviceName: 'Pixel' });

  assert.equal(response.status, 201);
  assert.equal(response.body.device.device_type, 'android');
  assert.deepEqual(insertValues, [companyId, userId, 'android', 'Pixel', 'fcm-token-with-enough-characters']);
});

test('authenticated users can revoke their own device push token', async () => {
  const companyId = '9ed485e6-054f-4c3f-8d98-0b0f55662d72';
  const userId = '6975b187-ad72-42df-bb73-85ea968c5722';
  const pushToken = 'fcm-token-with-enough-characters';
  const token = jwt.sign({ sub: userId, companyId, role: 'user' }, env.JWT_SECRET);
  let updateValues;
  const db = fakeDb(async (_sql, values) => {
    updateValues = values;
    return { rows: [{ id: 'device-1' }] };
  });

  const response = await request(createApp(db))
    .delete('/api/devices/push-token')
    .set('Authorization', `Bearer ${token}`)
    .send({ pushToken });

  assert.equal(response.status, 200);
  assert.equal(response.body.revoked, true);
  assert.deepEqual(updateValues, [companyId, userId, pushToken]);
});

test('users cannot start a call outside their direct conversation', async () => {
  const companyId = '9ed485e6-054f-4c3f-8d98-0b0f55662d72';
  const userId = '6975b187-ad72-42df-bb73-85ea968c5722';
  const participantId = '93fced7f-83eb-4bb9-90c6-1095f0761fb8';
  const conversationId = '27a87832-8c4f-4971-843a-a92de1149263';
  const token = jwt.sign({ sub: userId, companyId, role: 'company_admin' }, env.JWT_SECRET);
  let membershipValues;
  const db = fakeDb(async (_sql, values) => {
    membershipValues = values;
    return { rows: [] };
  });

  const response = await request(createApp(db))
    .post('/api/calls')
    .set('Authorization', `Bearer ${token}`)
    .send({ conversationId, participantId, callType: 'video' });

  assert.equal(response.status, 404);
  assert.equal(response.body.error.code, 'not_found');
  assert.deepEqual(membershipValues, [conversationId, companyId, userId, participantId]);
});

test('users can start a call without an ambiguous PostgreSQL call-type parameter', async () => {
  const companyId = '9ed485e6-054f-4c3f-8d98-0b0f55662d72';
  const userId = '6975b187-ad72-42df-bb73-85ea968c5722';
  const participantId = '93fced7f-83eb-4bb9-90c6-1095f0761fb8';
  const conversationId = '27a87832-8c4f-4971-843a-a92de1149263';
  const callId = 'f60b14a4-a95f-46bb-95cf-8ec0f385ea9b';
  const token = jwt.sign({ sub: userId, companyId, role: 'user' }, env.JWT_SECRET);
  let eventQuery;
  const client = {
    async query(sql) {
      if (sql.includes('SELECT c.id, target.first_name')) return { rows: [{ id: conversationId }] };
      if (sql.includes('SELECT c.id\n         FROM calls')) return { rows: [] };
      if (sql.includes('INSERT INTO calls')) {
        return { rows: [{ id: callId, company_id: companyId, conversation_id: conversationId, created_by: userId, call_type: 'audio', status: 'ringing' }] };
      }
      if (sql.includes('INSERT INTO call_events')) eventQuery = sql;
      return { rows: [] };
    },
    release() {},
  };
  const db = {
    async query() { return { rows: [] }; },
    async connect() { return client; },
  };

  const response = await request(createApp(db))
    .post('/api/calls')
    .set('Authorization', `Bearer ${token}`)
    .send({ conversationId, participantId, callType: 'audio' });

  assert.equal(response.status, 201);
  assert.equal(response.body.call.id, callId);
  assert.match(eventQuery, /\$3::text/);
});

test('starting a new call replaces an abandoned active call between the same users', async () => {
  const companyId = '9ed485e6-054f-4c3f-8d98-0b0f55662d72';
  const userId = '6975b187-ad72-42df-bb73-85ea968c5722';
  const participantId = '93fced7f-83eb-4bb9-90c6-1095f0761fb8';
  const conversationId = '27a87832-8c4f-4971-843a-a92de1149263';
  const abandonedCallId = '190c2c72-dc3b-4f47-a761-08cfec1d55c8';
  const nextCallId = 'f60b14a4-a95f-46bb-95cf-8ec0f385ea9b';
  const token = jwt.sign({ sub: userId, companyId, role: 'user' }, env.JWT_SECRET);
  let replacementValues;
  const client = {
    async query(sql, values) {
      if (sql.includes('SELECT c.id, target.first_name')) return { rows: [{ id: conversationId }] };
      if (sql.includes('FOR UPDATE OF c')) return { rows: [{ id: abandonedCallId }] };
      if (sql.includes("SET status = 'ended'")) {
        replacementValues = values;
        return { rows: [] };
      }
      if (sql.includes('INSERT INTO calls')) {
        return { rows: [{ id: nextCallId, company_id: companyId, conversation_id: conversationId, created_by: userId, call_type: 'audio', status: 'ringing' }] };
      }
      return { rows: [] };
    },
    release() {},
  };
  const db = {
    async query() { return { rows: [] }; },
    async connect() { return client; },
  };

  const response = await request(createApp(db))
    .post('/api/calls')
    .set('Authorization', `Bearer ${token}`)
    .send({ conversationId, participantId, callType: 'audio' });

  assert.equal(response.status, 201);
  assert.equal(response.body.call.id, nextCallId);
  assert.deepEqual(replacementValues, [abandonedCallId, userId]);
});

test('users can end a call without ambiguous PostgreSQL status or reason values', async () => {
  const companyId = '9ed485e6-054f-4c3f-8d98-0b0f55662d72';
  const userId = '6975b187-ad72-42df-bb73-85ea968c5722';
  const callId = 'f60b14a4-a95f-46bb-95cf-8ec0f385ea9b';
  const token = jwt.sign({ sub: userId, companyId, role: 'user' }, env.JWT_SECRET);
  let updateQuery;
  let eventQuery;
  const db = fakeDb(async (sql) => {
    if (sql.includes('UPDATE calls c')) {
      updateQuery = sql;
      return { rows: [{ id: callId }] };
    }
    if (sql.includes('INSERT INTO call_events')) {
      eventQuery = sql;
      return { rows: [] };
    }
    return { rows: [{ id: callId, status: 'ended', participant_ids: [userId] }] };
  });

  const response = await request(createApp(db))
    .post(`/api/calls/${callId}/end`)
    .set('Authorization', `Bearer ${token}`)
    .send({ reason: 'completed' });

  assert.equal(response.status, 200);
  assert.equal(response.body.call.status, 'ended');
  assert.match(updateQuery, /CASE WHEN c\.status/);
  assert.match(eventQuery, /\$3::text/);
});

test('LiveKit tokens are short-lived and scoped to one room', async () => {
  const previous = {
    url: env.LIVEKIT_URL,
    key: env.LIVEKIT_API_KEY,
    secret: env.LIVEKIT_API_SECRET,
  };
  env.LIVEKIT_URL = 'wss://rtc.example.com';
  env.LIVEKIT_API_KEY = 'test-key';
  env.LIVEKIT_API_SECRET = 'test-secret-with-enough-entropy';
  try {
    const result = await createRoomToken({ roomName: 'company-call-room', userId: 'user-id', displayName: 'Test User' });
    const claims = jwt.verify(result.token, env.LIVEKIT_API_SECRET, { algorithms: ['HS256'] });
    assert.equal(result.url, env.LIVEKIT_URL);
    assert.equal(claims.iss, env.LIVEKIT_API_KEY);
    assert.equal(claims.sub, 'user-id');
    assert.equal(claims.video.room, 'company-call-room');
    assert.equal(claims.video.roomJoin, true);
    assert.equal(claims.video.canPublish, true);
    assert.ok(claims.exp - claims.nbf <= 15 * 60);
  } finally {
    env.LIVEKIT_URL = previous.url;
    env.LIVEKIT_API_KEY = previous.key;
    env.LIVEKIT_API_SECRET = previous.secret;
  }
});

test('unknown API routes return a structured 404', async () => {
  const response = await request(createApp(fakeDb())).get('/api/missing');
  assert.equal(response.status, 404);
  assert.equal(response.body.error.code, 'route_not_found');
});
