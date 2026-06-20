import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { rateLimit } from 'express-rate-limit';
import { z } from 'zod';
import { env } from '../config/env.js';
import { asyncHandler } from '../lib/async-handler.js';
import { AppError } from '../lib/errors.js';
import { normalizeMobileNumber } from '../lib/phone-number.js';
import { authenticate } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';

const loginSchema = z.object({
  companySlug: z.string().trim().min(2).max(80).toLowerCase(),
  mobileNumber: z.string().trim().min(6).max(30),
  password: z.string().min(8).max(128)
});

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-8',
  legacyHeaders: false
});

function publicUser(user) {
  const { password_hash: _passwordHash, ...safeUser } = user;
  return safeUser;
}

export function createAuthRouter(db) {
  const router = Router();

  router.post('/login', loginLimiter, validate(loginSchema), asyncHandler(async (request, response) => {
    const { companySlug, mobileNumber, password } = request.body;
    const normalizedMobileNumber = normalizeMobileNumber(mobileNumber);
    const result = await db.query(
      `SELECT u.*, c.slug AS company_slug, c.status AS company_status
       FROM users u
       JOIN companies c ON c.id = u.company_id
       WHERE c.slug = $1 AND u.mobile_number = $2`,
      [companySlug, normalizedMobileNumber]
    );
    const user = result.rows[0];

    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      throw new AppError(401, 'invalid_credentials', 'Invalid company, mobile number, or password');
    }
    if (user.status !== 'active' || user.company_status !== 'active') {
      throw new AppError(403, 'account_inactive', 'The user or company account is not active');
    }

    await db.query('UPDATE users SET last_login_at = now(), updated_at = now() WHERE id = $1', [user.id]);
    const token = jwt.sign(
      { sub: user.id, companyId: user.company_id, role: user.role },
      env.JWT_SECRET,
      { algorithm: 'HS256', expiresIn: env.JWT_EXPIRES_IN }
    );

    response.json({ token, tokenType: 'Bearer', expiresIn: env.JWT_EXPIRES_IN, user: publicUser(user) });
  }));

  router.get('/me', authenticate, asyncHandler(async (request, response) => {
    const result = await db.query(
      `SELECT id, company_id, first_name, last_name, employee_code, job_title,
              mobile_number, country_code, timezone, email, role, profile_photo_url, status, last_login_at
       FROM users WHERE id = $1 AND company_id = $2`,
      [request.auth.sub, request.auth.companyId]
    );
    if (!result.rows[0]) throw new AppError(401, 'user_not_found', 'Authenticated user no longer exists');
    response.json({ user: result.rows[0] });
  }));

  return router;
}
