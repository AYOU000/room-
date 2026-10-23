import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { randomUUID } from 'node:crypto';
import { errorHandler } from './shared/middleware/errorHandler';

export function createApp(options: { origin: string; ready: () => Promise<void>; draining: () => boolean }) {
  const app = express();
  app.disable('x-powered-by');
  app.use(helmet());
  app.use(cors({ origin: options.origin, credentials: true }));
  app.use((_req, res, next) => { res.setHeader('X-Request-Id', randomUUID()); next(); });
  app.use(express.json({ limit: '32kb' }));
  app.get('/health/live', (_req, res) => { res.json({ status: 'ok', service: 'api' }); });
  app.get('/health/ready', async (_req, res) => {
    if (options.draining()) { res.status(503).json({ status: 'draining', service: 'api' }); return; }
    try { await options.ready(); res.json({ status: 'ok', service: 'api' }); }
    catch { res.status(503).json({ status: 'unavailable', service: 'api' }); }
  });
  // Feature owners register authenticated business routes here.
  app.use(errorHandler);
  return app;
}
