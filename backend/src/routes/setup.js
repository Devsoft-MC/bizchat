import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { asyncHandler } from '../lib/async-handler.js';
import { AppError } from '../lib/errors.js';
import { normalizeMobileNumber } from '../lib/phone-number.js';
import { validate } from '../middleware/validate.js';

const setupSchema = z.object({
  company: z.object({
    name: z.string().trim().min(2).max(150),
    slug: z.string().trim().min(2).max(80).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    country: z.string().trim().max(100).optional(),
    timezone: z.string().trim().min(1).max(100).default('Asia/Riyadh')
  }),
  admin: z.object({
    firstName: z.string().trim().min(1).max(100),
    lastName: z.string().trim().max(100).optional(),
    mobileNumber: z.string().trim().min(6).max(30),
    email: z.string().email().max(255).optional(),
    password: z.string().min(8).max(128)
  })
});

export function createSetupRouter(db) {
  const router = Router();

  router.post('/', validate(setupSchema), asyncHandler(async (request, response) => {
    const client = await db.connect();
    try {
      await client.query('BEGIN');
      await client.query("SELECT pg_advisory_xact_lock(hashtext('bizchat_initial_setup'))");
      const countResult = await client.query('SELECT count(*)::int AS count FROM companies');
      if (countResult.rows[0].count > 0) {
        throw new AppError(409, 'setup_complete', 'Initial setup has already been completed');
      }

      const { company, admin } = request.body;
      const companyResult = await client.query(
        `INSERT INTO companies (name, slug, country, timezone)
         VALUES ($1, $2, $3, $4)
         RETURNING id, name, slug, country, timezone, status, created_at`,
        [company.name, company.slug, company.country ?? null, company.timezone]
      );
      const passwordHash = await bcrypt.hash(admin.password, 12);
      const userResult = await client.query(
        `INSERT INTO users
          (company_id, first_name, last_name, mobile_number, email, password_hash, role)
         VALUES ($1, $2, $3, $4, $5, $6, 'super_admin')
         RETURNING id, company_id, first_name, last_name, mobile_number, email, role, status, created_at`,
        [companyResult.rows[0].id, admin.firstName, admin.lastName ?? null,
          normalizeMobileNumber(admin.mobileNumber), admin.email ?? null, passwordHash]
      );
      await client.query('UPDATE companies SET created_by = $1 WHERE id = $2', [userResult.rows[0].id, companyResult.rows[0].id]);
      await client.query('COMMIT');
      response.status(201).json({ company: companyResult.rows[0], admin: userResult.rows[0] });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }));

  return router;
}
