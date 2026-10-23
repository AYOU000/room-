import pino from 'pino';
export function createLogger(level = 'info') {
  return pino({ level, redact: ['req.headers.authorization', 'req.headers.cookie', 'password', 'token', 'secret', 'DATABASE_URL', 'S3_SECRET_ACCESS_KEY'] });
}
