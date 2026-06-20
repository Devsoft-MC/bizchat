import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../lib/async-handler.js';
import { notFound } from '../lib/errors.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';

const createSchema = z.object({
  name: z.string().trim().min(2).max(150),
  description: z.string().trim().max(1000).optional(),
  parentDepartmentId: z.string().uuid().optional(),
  managerUserId: z.string().uuid().optional()
});

export function createDepartmentsRouter(db) {
  const router = Router();
  router.use(authenticate);

  router.get('/', asyncHandler(async (request, response) => {
    const result = await db.query(
      `SELECT id, parent_department_id, name, description, manager_user_id, status, created_at, updated_at
       FROM departments WHERE company_id = $1 ORDER BY name`,
      [request.auth.companyId]
    );
    response.json({ departments: result.rows });
  }));

  router.post('/', authorize('super_admin', 'company_admin'), validate(createSchema), asyncHandler(async (request, response) => {
    const { name, description, parentDepartmentId, managerUserId } = request.body;
    const result = await db.query(
      `INSERT INTO departments
        (company_id, name, description, parent_department_id, manager_user_id, created_by)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, parent_department_id, name, description, manager_user_id, status, created_at`,
      [request.auth.companyId, name, description ?? null, parentDepartmentId ?? null,
        managerUserId ?? null, request.auth.sub]
    );
    response.status(201).json({ department: result.rows[0] });
  }));

  router.delete('/:id', authorize('super_admin', 'company_admin'), validate(z.object({ id: z.string().uuid() }), 'params'), asyncHandler(async (request, response) => {
    const result = await db.query(
      `UPDATE departments SET status = 'inactive', updated_at = now()
       WHERE id = $1 AND company_id = $2 RETURNING id, name, status, updated_at`,
      [request.params.id, request.auth.companyId]
    );
    if (!result.rows[0]) throw notFound('Department not found');
    response.json({ department: result.rows[0] });
  }));

  return router;
}
