import assert from 'node:assert/strict';
import test from 'node:test';
import jwt from 'jsonwebtoken';
import request from 'supertest';

process.env.NODE_ENV = 'test';
process.env.DATABASE_URL ??= 'postgresql://localhost:5432/bizchat_local';
process.env.JWT_SECRET ??= 'test_secret_at_least_16_chars';

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

test('unknown API routes return a structured 404', async () => {
  const response = await request(createApp(fakeDb())).get('/api/missing');
  assert.equal(response.status, 404);
  assert.equal(response.body.error.code, 'route_not_found');
});
