import type { Request, RequestHandler } from "express";
import { AppError } from "./errors.js";

// Single-instance baseline. A shared atomic store is required before scaling
// replicas. Restart resets counters; it must never reset authentication state.
export function createRateLimiter(options: {
  limit: number; windowMs: number; maxKeys?: number;
  key?: (req: Request) => string; now?: () => number;
}): RequestHandler {
  if (!Number.isSafeInteger(options.limit) || options.limit < 1 ||
      !Number.isSafeInteger(options.windowMs) || options.windowMs < 1) {
    throw new Error("Rate limit and window must be positive integers.");
  }
  const buckets = new Map<string, { count: number; expires: number }>();
  const now = options.now ?? Date.now;
  const maxKeys = options.maxKeys ?? 10_000;
  return (req, res, next) => {
    if (req.method === "GET" && req.path === "/health") { next(); return; }
    const time = now();
    for (const [key, bucket] of buckets) if (bucket.expires <= time) buckets.delete(key);
    const key = options.key?.(req) ?? req.ip ?? "unknown";
    let bucket = buckets.get(key);
    if (!bucket && buckets.size < maxKeys) {
      bucket = { count: 0, expires: time + options.windowMs };
      buckets.set(key, bucket);
    }
    if (!bucket || bucket.count >= options.limit) {
      const retry = Math.max(1, Math.ceil(((bucket?.expires ?? time + options.windowMs) - time) / 1000));
      res.setHeader("Retry-After", String(retry));
      next(new AppError(429, "RATE_LIMITED")); return;
    }
    bucket.count += 1;
    next();
  };
}
