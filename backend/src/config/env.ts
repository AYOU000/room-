import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  WORKER_PORT: z.coerce.number().int().min(1).max(65535).default(3001),
  DATABASE_URL: z.string().url().refine(v => /^postgres(ql)?:/.test(v), 'Expected PostgreSQL URL'),
  WEB_ORIGIN: z.string().url().default('http://localhost:5173'),
  S3_ENDPOINT: z.string().url(), S3_REGION: z.string().min(1).default('us-east-1'),
  S3_BUCKET: z.string().regex(/^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/),
  S3_ACCESS_KEY_ID: z.string().min(1), S3_SECRET_ACCESS_KEY: z.string().min(16),
  JOB_LEASE_SECONDS: z.coerce.number().int().min(5).max(3600).default(60),
  RETENTION_DAYS: z.coerce.number().int().min(1).max(3650).default(30),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error', 'silent']).default('info'),
});
export type Environment = z.infer<typeof schema>;
export function readEnvironment(input: NodeJS.ProcessEnv = process.env): Environment {
  const result = schema.safeParse(input);
  if (!result.success) {
    throw new Error(`Invalid environment: ${result.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ')}`);
  }
  if (result.data.NODE_ENV === 'production' && !result.data.WEB_ORIGIN.startsWith('https://')) {
    throw new Error('Production WEB_ORIGIN must use HTTPS');
  }
  return result.data;
}
