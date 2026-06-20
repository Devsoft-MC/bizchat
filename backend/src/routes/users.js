import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { asyncHandler } from '../lib/async-handler.js';
import { AppError, notFound } from '../lib/errors.js';
import { normalizeMobileNumber } from '../lib/phone-number.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';

const createSchema = z.object({
  firstName: z.string().trim().min(1).max(100),
  lastName: z.string().trim().max(100).optional(),
  employeeCode: z.string().trim().max(50).optional(),
  jobTitle: z.string().trim().max(150).optional(),
  mobileNumber: z.string().trim().min(6).max(30),
  countryCode: z.string().trim().length(2).toUpperCase().optional(),
  timezone: z.string().trim().min(1).max(100).optional(),
  email: z.string().email().max(255).optional(),
  password: z.string().min(8).max(128),
  role: z.enum(['company_admin', 'user']).default('user'),
  departmentIds: z.array(z.string().uuid()).max(20).default([])
});

export function createUsersRouter(db) {
  const router = Router();
  router.use(authenticate);

  router.get('/directory', asyncHandler(async (request, response) => {
    const result = await db.query(
      `SELECT u.id, u.first_name, u.last_name, u.job_title, u.profile_photo_url,
              COALESCE(array_agg(d.name ORDER BY d.name)
                FILTER (WHERE d.id IS NOT NULL), '{}') AS department_names
       FROM users u
       LEFT JOIN user_departments ud ON ud.user_id = u.id
       LEFT JOIN departments d ON d.id = ud.department_id AND d.status = 'active'
       WHERE u.company_id = $1 AND u.status = 'active' AND u.id <> $2
       GROUP BY u.id
       ORDER BY u.first_name, u.last_name`,
      [request.auth.companyId, request.auth.sub]
    );
    response.json({ users: result.rows });
  }));

  router.get('/', authorize('super_admin', 'company_admin'), asyncHandler(async (request, response) => {
    const result = await db.query(
      `SELECT u.id, u.first_name, u.last_name, u.employee_code, u.job_title,
              u.mobile_number, u.country_code, u.timezone, u.email, u.role,
              u.profile_photo_url, u.status, u.last_login_at, u.created_at,
              COALESCE(array_agg(d.name ORDER BY d.name)
                FILTER (WHERE d.id IS NOT NULL), '{}') AS department_names
       FROM users u
       LEFT JOIN user_departments ud ON ud.user_id = u.id
       LEFT JOIN departments d ON d.id = ud.department_id
       WHERE u.company_id = $1
       GROUP BY u.id
       ORDER BY u.first_name, u.last_name`,
      [request.auth.companyId]
    );
    response.json({ users: result.rows });
  }));

  router.post('/', authorize('super_admin', 'company_admin'), validate(createSchema), asyncHandler(async (request, response) => {
    const client = await db.connect();
    try {
      await client.query('BEGIN');
      const input = request.body;
      const mobileNumber = normalizeMobileNumber(input.mobileNumber);
      const passwordHash = await bcrypt.hash(input.password, 12);
      const result = await client.query(
        `INSERT INTO users
          (company_id, first_name, last_name, employee_code, job_title, mobile_number,
           country_code, timezone, email, password_hash, role, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
         RETURNING id, company_id, first_name, last_name, employee_code, job_title,
                   mobile_number, country_code, timezone, email, role, status, created_at`,
        [request.auth.companyId, input.firstName, input.lastName ?? null,
          input.employeeCode ?? null, input.jobTitle ?? null, mobileNumber,
          input.countryCode ?? null, input.timezone ?? null, input.email ?? null,
          passwordHash, input.role, request.auth.sub]
      );

      for (const departmentId of input.departmentIds) {
        const department = await client.query(
          'SELECT id FROM departments WHERE id = $1 AND company_id = $2 AND status = $3',
          [departmentId, request.auth.companyId, 'active']
        );
        if (!department.rows[0]) throw new AppError(400, 'invalid_department', 'A selected department is invalid');
        await client.query(
          'INSERT INTO user_departments (user_id, department_id) VALUES ($1, $2)',
          [result.rows[0].id, departmentId]
        );
      }

      await client.query('COMMIT');
      response.status(201).json({ user: result.rows[0] });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }));

  router.patch('/:id/status', authorize('super_admin', 'company_admin'), validate(z.object({ id: z.string().uuid() }), 'params'), validate(z.object({ status: z.enum(['active', 'inactive', 'suspended']) })), asyncHandler(async (request, response) => {
    if (request.params.id === request.auth.sub && request.body.status !== 'active') {
      throw new AppError(400, 'self_deactivation', 'You cannot deactivate your own account');
    }
    const result = await db.query(
      `UPDATE users SET status = $1,
         deactivated_at = CASE WHEN $1 = 'active' THEN NULL ELSE now() END,
         deactivated_by = CASE WHEN $1 = 'active' THEN NULL ELSE $2 END,
         updated_at = now()
       WHERE id = $3 AND company_id = $4
       RETURNING id, first_name, last_name, mobile_number, role, status, updated_at`,
      [request.body.status, request.auth.sub, request.params.id, request.auth.companyId]
    );
    if (!result.rows[0]) throw notFound('User not found');
    response.json({ user: result.rows[0] });
  }));

  return router;
}
