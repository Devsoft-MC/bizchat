import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../lib/async-handler.js';
import { authenticate } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';

const pushTokenSchema = z.object({
  pushToken: z.string().trim().min(20).max(4096),
  deviceType: z.enum(['web', 'ios', 'android']),
  deviceName: z.string().trim().max(160).optional()
});

const revokePushTokenSchema = pushTokenSchema.pick({ pushToken: true });

export function createDevicesRouter(db) {
  const router = Router();
  router.use(authenticate);

  router.post('/push-token', validate(pushTokenSchema), asyncHandler(async (request, response) => {
    const { pushToken, deviceType, deviceName } = request.body;
    const updated = await db.query(
      `UPDATE user_devices
       SET company_id = $1, user_id = $2, device_type = $3, device_name = $4,
           status = 'active', last_active_at = now(), updated_at = now()
       WHERE push_token = $5
       RETURNING id, device_type, device_name, status, last_active_at`,
      [request.auth.companyId, request.auth.sub, deviceType, deviceName ?? null, pushToken]
    );

    if (updated.rows[0]) {
      response.json({ device: updated.rows[0] });
      return;
    }

    const inserted = await db.query(
      `INSERT INTO user_devices
        (company_id, user_id, device_type, device_name, push_token, last_active_at)
       VALUES ($1, $2, $3, $4, $5, now())
       RETURNING id, device_type, device_name, status, last_active_at`,
      [request.auth.companyId, request.auth.sub, deviceType, deviceName ?? null, pushToken]
    );
    response.status(201).json({ device: inserted.rows[0] });
  }));

  router.delete('/push-token', validate(revokePushTokenSchema), asyncHandler(async (request, response) => {
    const result = await db.query(
      `UPDATE user_devices
       SET status = 'revoked', last_active_at = now(), updated_at = now()
       WHERE company_id = $1 AND user_id = $2 AND push_token = $3
         AND status <> 'revoked'
       RETURNING id`,
      [request.auth.companyId, request.auth.sub, request.body.pushToken]
    );
    response.json({ revoked: Boolean(result.rows[0]) });
  }));

  return router;
}
