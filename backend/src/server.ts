import { createApp } from './app';
import { readEnvironment } from './config/env';
import { createLogger } from './config/logger';
import { createPool } from './infrastructure/database';
import { createStorage } from './infrastructure/storage';

const env = readEnvironment();
const logger = createLogger(env.LOG_LEVEL);
const pool = createPool(env.DATABASE_URL);
const storage = createStorage(env);
let draining = false;
pool.on('error', () => logger.error('Database connection error'));
const app = createApp({ origin: env.WEB_ORIGIN, draining: () => draining, ready: async () => {
  const schema = await pool.query("SELECT 1 FROM schema_migrations WHERE name='002_audio_write_guards.up.sql'");
  if (!schema.rowCount) throw new Error('Required schema migration missing');
  await storage.ready();
} });
const server = app.listen(env.PORT, () => logger.info({ port: env.PORT }, 'API listening'));
for (const signal of ['SIGTERM', 'SIGINT'] as const) process.once(signal, () => {
  draining = true;
  logger.info('Draining API connections');
  const deadline = setTimeout(() => { server.closeAllConnections(); process.exitCode = 1; }, 25000);
  deadline.unref();
  server.close(async () => { await pool.end(); storage.close(); clearTimeout(deadline); });
});
