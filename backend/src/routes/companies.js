import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { asyncHandler } from '../lib/async-handler.js';
import { notFound } from '../lib/errors.js';
import { normalizeMobileNumber } from '../lib/phone-number.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';

const updateSchema = z.object({
  name: z.string().trim().min(2).max(150).optional(),
  country: z.string().trim().max(100).nullable().optional(),
  timezone: z.string().trim().min(1).max(100).optional(),
  address: z.string().trim().max(500).nullable().optional(),
  contactMobile: z.string().trim().max(30).nullable().optional()
}).refine((value) => Object.keys(value).length > 0, 'At least one field is required');

const createSchema = z.object({
  name: z.string().trim().min(2).max(150),
  slug: z.string().trim().min(2).max(80).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  country: z.string().trim().max(100).optional(),
  timezone: z.string().trim().min(1).max(100),
  admin: z.object({
    firstName: z.string().trim().min(1).max(100),
    lastName: z.string().trim().max(100).optional(),
    mobileNumber: z.string().trim().min(6).max(30),
    countryCode: z.string().trim().length(2).toUpperCase().optional(),
    timezone: z.string().trim().min(1).max(100).optional(),
    email: z.string().email().max(255).optional(),
    password: z.string().min(8).max(128)
  }),
  departments: z.array(z.string().trim().min(1).max(150)).max(50).default([])
});

export function createCompaniesRouter(db) {
  const router = Router();
  router.use(authenticate);

  router.post('/', authorize('super_admin'), validate(createSchema), asyncHandler(async (request, response) => {
    const client = await db.connect();
    try {
      await client.query('BEGIN');
      const input = request.body;
      const companyResult = await client.query(
        `INSERT INTO companies (name, slug, country, timezone)
         VALUES ($1, $2, $3, $4)
         RETURNING id, name, slug, country, timezone, status, created_at`,
        [input.name, input.slug, input.country ?? null, input.timezone]
      );
      const company = companyResult.rows[0];
      const passwordHash = await bcrypt.hash(input.admin.password, 12);
      const adminResult = await client.query(
        `INSERT INTO users
          (company_id, first_name, last_name, mobile_number, country_code, timezone,
           email, password_hash, role)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'company_admin')
         RETURNING id, company_id, first_name, last_name, mobile_number, country_code,
                   timezone, email, role, status, created_at`,
        [company.id, input.admin.firstName, input.admin.lastName ?? null,
          normalizeMobileNumber(input.admin.mobileNumber), input.admin.countryCode ?? null,
          input.admin.timezone ?? input.timezone, input.admin.email ?? null, passwordHash]
      );
      const admin = adminResult.rows[0];
      await client.query('UPDATE companies SET created_by = $1 WHERE id = $2', [admin.id, company.id]);
      const departments = [];
      for (const name of [...new Set(input.departments)]) {
        const departmentResult = await client.query(
          `INSERT INTO departments (company_id, name, created_by)
           VALUES ($1, $2, $3)
           RETURNING id, name, status, created_at`,
          [company.id, name, admin.id]
        );
        departments.push(departmentResult.rows[0]);
      }
      await client.query('COMMIT');
      response.status(201).json({ company, admin, departments });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }));

  router.get('/current', asyncHandler(async (request, response) => {
    const result = await db.query(
      `SELECT id, name, slug, country, timezone, address, contact_mobile, logo_url,
              settings, status, created_at, updated_at
       FROM companies WHERE id = $1`,
      [request.auth.companyId]
    );
    if (!result.rows[0]) throw notFound('Company not found');
    response.json({ company: result.rows[0] });
  }));

  router.patch('/current', authorize('super_admin', 'company_admin'), validate(updateSchema), asyncHandler(async (request, response) => {
    const { name, country, timezone, address, contactMobile } = request.body;
    const result = await db.query(
      `UPDATE companies SET
         name = COALESCE($2, name), country = COALESCE($3, country),
         timezone = COALESCE($4, timezone), address = COALESCE($5, address),
         contact_mobile = COALESCE($6, contact_mobile), updated_at = now()
       WHERE id = $1
       RETURNING id, name, slug, country, timezone, address, contact_mobile, status, updated_at`,
      [request.auth.companyId, name, country, timezone, address, contactMobile]
    );
    response.json({ company: result.rows[0] });
  }));

  return router;
}
