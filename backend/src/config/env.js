import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const optionalString = z.preprocess((value) => value === '' ? undefined : value, z.string().min(1).optional());

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  HOST: z.string().min(1).default('127.0.0.1'),
  PORT: z.coerce.number().int().positive().max(65535).default(5000),
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(16, 'JWT_SECRET must contain at least 16 characters'),
  JWT_EXPIRES_IN: z.string().default('8h'),
  CORS_ORIGIN: z.string().default('*'),
  FCM_SERVICE_ACCOUNT_JSON: z.string().optional(),
  FCM_SERVICE_ACCOUNT_BASE64: z.string().optional(),
  LIVEKIT_URL: z.preprocess((value) => value === '' ? undefined : value, z.string().url().optional()),
  LIVEKIT_API_KEY: optionalString,
  LIVEKIT_API_SECRET: optionalString,
  SOCKET_IO_PATH: z.string().min(1).default('/socket.io')
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const details = parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join(', ');
  throw new Error(`Invalid environment configuration: ${details}`);
}

export const env = parsed.data;
