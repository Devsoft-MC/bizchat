import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { pool, closeDatabase } from '../src/config/database.js';
import { normalizeMobileNumber } from '../src/lib/phone-number.js';

function readArguments(values) {
  const result = {};
  for (let index = 0; index < values.length; index += 2) {
    const key = values[index];
    const value = values[index + 1];
    if (!key?.startsWith('--') || !value) throw new Error(`Invalid argument near ${key ?? 'end of command'}`);
    const normalizedKey = key.slice(2);
    if (normalizedKey === 'department') {
      result.departments = [...(result.departments ?? []), value];
    } else {
      result[normalizedKey] = value;
    }
  }
  return result;
}

const input = readArguments(process.argv.slice(2));
const required = ['name', 'slug', 'country', 'timezone', 'admin-first', 'mobile', 'email'];
for (const key of required) {
  if (!input[key]) throw new Error(`Missing required argument --${key}`);
}

const temporaryPassword = crypto.randomBytes(12).toString('base64url') + 'aA1!';
const client = await pool.connect();

try {
  await client.query('BEGIN');
  const companyResult = await client.query(
    `INSERT INTO companies (name, slug, country, timezone)
     VALUES ($1, $2, $3, $4)
     RETURNING id, name, slug, country, timezone`,
    [input.name, input.slug, input.country, input.timezone]
  );
  const company = companyResult.rows[0];
  const passwordHash = await bcrypt.hash(temporaryPassword, 12);
  const adminResult = await client.query(
    `INSERT INTO users
      (company_id, first_name, last_name, mobile_number, country_code, timezone,
       email, password_hash, role)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'company_admin')
     RETURNING id, first_name, last_name, mobile_number, email, role`,
    [company.id, input['admin-first'], input['admin-last'] ?? null,
      normalizeMobileNumber(input.mobile), input['country-code']?.toUpperCase() ?? null,
      input['admin-timezone'] ?? input.timezone, input.email.toLowerCase(), passwordHash]
  );
  const admin = adminResult.rows[0];
  await client.query('UPDATE companies SET created_by = $1 WHERE id = $2', [admin.id, company.id]);

  for (const department of [...new Set(input.departments ?? [])]) {
    await client.query(
      `INSERT INTO departments (company_id, name, created_by) VALUES ($1, $2, $3)`,
      [company.id, department, admin.id]
    );
  }
  await client.query('COMMIT');
  console.log(JSON.stringify({ company, admin, departments: input.departments ?? [], temporaryPassword }, null, 2));
} catch (error) {
  await client.query('ROLLBACK');
  throw error;
} finally {
  client.release();
  await closeDatabase();
}
