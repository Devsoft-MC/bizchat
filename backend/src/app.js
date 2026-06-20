import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { env } from './config/env.js';
import { pool } from './config/database.js';
import { errorHandler, notFoundHandler } from './middleware/errors.js';
import { createAuthRouter } from './routes/auth.js';
import { createCompaniesRouter } from './routes/companies.js';
import { createDepartmentsRouter } from './routes/departments.js';
import { createHealthRouter } from './routes/health.js';
import { createSetupRouter } from './routes/setup.js';
import { createUsersRouter } from './routes/users.js';

export function createApp(db = pool) {
  const app = express();

  app.disable('x-powered-by');
  app.use(helmet());
  app.use(cors({ origin: env.CORS_ORIGIN === '*' ? true : env.CORS_ORIGIN.split(',') }));
  app.use(express.json({ limit: '1mb' }));

  app.use('/api/health', createHealthRouter(db));
  app.use('/api/setup', createSetupRouter(db));
  app.use('/api/auth', createAuthRouter(db));
  app.use('/api/companies', createCompaniesRouter(db));
  app.use('/api/departments', createDepartmentsRouter(db));
  app.use('/api/users', createUsersRouter(db));

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
