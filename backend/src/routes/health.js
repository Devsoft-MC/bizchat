import { Router } from 'express';
import { asyncHandler } from '../lib/async-handler.js';

export function createHealthRouter(db) {
  const router = Router();

  router.get('/', (_request, response) => {
    response.json({ status: 'ok', service: 'bizchat-api', timestamp: new Date().toISOString() });
  });

  router.get('/ready', asyncHandler(async (_request, response) => {
    await db.query('SELECT 1');
    response.json({ status: 'ready', database: 'connected' });
  }));

  return router;
}
