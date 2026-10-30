import { randomUUID, timingSafeEqual } from "node:crypto";
import type { RequestHandler } from "express";
import type { AuditRecord } from "../app.js";
import type { SecurityConfig } from "./config.js";
import { AppError } from "./errors.js";

export function requestContext(audit: (record: AuditRecord) => void): RequestHandler {
  return (req, res, next) => {
    res.locals.requestId = randomUUID();
    res.setHeader("X-Request-ID", res.locals.requestId);
    const started = performance.now();
    res.on("finish", () => audit({
      requestId: res.locals.requestId, method: req.method,
      route: typeof req.route?.path === "string" ? req.route.path : "unmatched",
      status: res.statusCode, errorCode: res.locals.errorCode,
      durationMs: Math.round(performance.now() - started),
    }));
    next();
  };
}

export function securityHeaders(config: SecurityConfig): RequestHandler {
  return (_req, res, next) => {
    res.set({
      "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'",
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "DENY",
      "Referrer-Policy": "no-referrer",
      "Permissions-Policy": "camera=(), display-capture=(), microphone=(self)",
      "Cache-Control": "no-store",
    });
    if (config.environment === "production") res.setHeader("Strict-Transport-Security", "max-age=31536000");
    next();
  };
}

export function validateOrigin(allowed: readonly string[]): RequestHandler {
  return (req, _res, next) => {
    const origin = req.get("origin");
    if (origin !== undefined && !allowed.includes(origin)) {
      next(new AppError(403, "ORIGIN_NOT_ALLOWED")); return;
    }
    next();
  };
}

export const requireJson: RequestHandler = (req, _res, next) => {
  if (["POST", "PUT", "PATCH", "DELETE"].includes(req.method) &&
      (!req.is("application/json") || (req.get("content-encoding") ?? "identity") !== "identity")) {
    next(new AppError(415, "UNSUPPORTED_MEDIA_TYPE")); return;
  }
  next();
};

// Bind the expected synchronizer token to the verified refresh session, not to
// an untrusted cookie/header pair. Member 1 supplies the session lookup.
export function csrfProtection(options: {
  allowedOrigins: readonly string[];
  expectedToken: (locals: Record<string, unknown>) => string | undefined;
}): RequestHandler {
  return (req, res, next) => {
    if (!options.allowedOrigins.includes(req.get("origin") ?? "")) {
      next(new AppError(403, "ORIGIN_NOT_ALLOWED")); return;
    }
    const expected = options.expectedToken(res.locals);
    const actual = req.get("x-csrf-token");
    if (!expected || !actual || expected.length < 32 || actual.length > 256 ||
        Buffer.byteLength(expected) !== Buffer.byteLength(actual) ||
        !timingSafeEqual(Buffer.from(expected), Buffer.from(actual))) {
      next(new AppError(403, "CSRF_INVALID")); return;
    }
    next();
  };
}
