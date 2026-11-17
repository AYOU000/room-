import { createRemoteJWKSet, jwtVerify } from 'jose';
import type { RequestHandler } from 'express';
import { AppError } from './security-errors.js';
import { uuidSchema } from './security-validation.js';

export function sessionAuth(env = process.env) {
  const issuer = env.AUTH_ISSUER;
  const audience = env.AUTH_AUDIENCE;
  const url = env.AUTH_JWKS_URL;
  if (url && new URL(url).protocol !== 'https:') throw new Error('AUTH_JWKS_URL must use HTTPS');
  const keys = url ? createRemoteJWKSet(new URL(url)) : undefined;
  async function verify(header?: string): Promise<string> {
    if (!issuer || !audience || !keys) throw new AppError(503, 'SERVICE_UNAVAILABLE');
    if (!header?.startsWith('Bearer ')) throw new AppError(401, 'UNAUTHENTICATED');
    try {
      const { payload } = await jwtVerify(header.slice(7), keys, {
        issuer, audience, algorithms: ['RS256', 'ES256'], requiredClaims: ['sub', 'exp', 'iat'],
      });
      return uuidSchema.parse(payload.sub);
    } catch { throw new AppError(401, 'UNAUTHENTICATED'); }
  }
  const middleware: RequestHandler = async (req, res, next) => {
    try { res.locals.authenticatedUserId = await verify(req.get('authorization')); next(); }
    catch (error) { next(error); }
  };
  return { verify, middleware };
}
