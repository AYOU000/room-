import { z } from "zod";
import type { RequestHandler } from "express";
import { AppError } from "./errors.js";

export const uuidSchema = z.uuid();
export const mediaTokenRequestSchema = z.strictObject({
  roomName: z.string().trim().regex(/^[a-zA-Z0-9_-]{1,64}$/),
  identity: z.string().trim().regex(/^[a-zA-Z0-9_-]{1,64}$/),
});
export const registrationSchema = z.strictObject({
  email: z.email().max(254).transform((value) => value.toLowerCase()),
  displayName: z.string().trim().min(2).max(50),
  // Passwords must never be trimmed, normalized, logged or reflected.
  password: z.string().min(15).max(128),
});
export const createRoomSchema = z.strictObject({
  title: z.string().trim().min(5).max(200),
  description: z.string().trim().max(2000).optional(),
  durationSeconds: z.number().int().min(120).max(1800).default(600),
});
export const historyQuerySchema = z.strictObject({
  page: z.string().regex(/^[1-9]\d{0,5}$/).transform(Number).default(1),
  limit: z.string().regex(/^(?:[1-9]|[1-4]\d|50)$/).transform(Number).default(20),
});

export function validateBody<T>(schema: z.ZodType<T>): RequestHandler {
  return (req, _res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) { next(new AppError(400, "INVALID_INPUT")); return; }
    req.body = result.data;
    next();
  };
}

// Query/params are read-only in Express 5: use the returned typed value.
export function parseInput<T>(schema: z.ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input);
  if (!result.success) throw new AppError(400, "INVALID_INPUT");
  return result.data;
}

export function parseEvent<T>(schema: z.ZodType<T>, frame: string | Buffer): T {
  if (Buffer.byteLength(frame) > 16 * 1024) throw new AppError(413, "PAYLOAD_TOO_LARGE");
  let value: unknown;
  try { value = JSON.parse(frame.toString()); }
  catch { throw new AppError(400, "INVALID_JSON"); }
  return parseInput(schema, value);
}
