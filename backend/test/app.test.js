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

test('unknown API routes return a structured 404', async () => {
  const response = await request(createApp(fakeDb())).get('/api/missing');
  assert.equal(response.status, 404);
  assert.equal(response.body.error.code, 'route_not_found');
});
