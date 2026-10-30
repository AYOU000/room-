import type { ErrorRequestHandler, RequestHandler } from "express";

export const errorMessages = {
  INVALID_INPUT: "Check the request fields and try again.",
  INVALID_JSON: "The request must contain valid JSON.",
  UNSUPPORTED_MEDIA_TYPE: "Use application/json without compression.",
  PAYLOAD_TOO_LARGE: "The request is too large.",
  UNAUTHENTICATED: "Sign in again to continue.",
  FORBIDDEN: "You do not have permission for this action.",
  ORIGIN_NOT_ALLOWED: "This application origin is not allowed.",
  CSRF_INVALID: "Refresh the page before trying again.",
  NOT_FOUND: "The requested resource is unavailable.",
  STATE_CONFLICT: "Refresh the session state before trying again.",
  RATE_LIMITED: "Too many requests. Wait before trying again.",
  SERVICE_UNAVAILABLE: "A required service is temporarily unavailable.",
  MEDIA_AUTHORIZATION_UNAVAILABLE: "Room access is not available yet.",
  INTERNAL_ERROR: "The request could not be completed.",
} as const;
export type ErrorCode = keyof typeof errorMessages;

export class AppError extends Error {
  constructor(public readonly status: number, public readonly code: ErrorCode) {
    super(errorMessages[code]);
  }
}

export const notFound: RequestHandler = (_req, _res, next) => next(new AppError(404, "NOT_FOUND"));

export const errorHandler: ErrorRequestHandler = (error: unknown, _req, res, _next) => {
  if (res.headersSent) { res.end(); return; }
  let failure = error instanceof AppError ? error : new AppError(500, "INTERNAL_ERROR");
  const type = typeof error === "object" && error !== null && "type" in error ? error.type : undefined;
  if (type === "entity.parse.failed") failure = new AppError(400, "INVALID_JSON");
  if (type === "entity.too.large") failure = new AppError(413, "PAYLOAD_TOO_LARGE");
  if (type === "encoding.unsupported" || type === "charset.unsupported") {
    failure = new AppError(415, "UNSUPPORTED_MEDIA_TYPE");
  }
  res.locals.errorCode = failure.code;
  res.status(failure.status).json({
    error: { code: failure.code, message: errorMessages[failure.code] },
    requestId: res.locals.requestId,
  });
};
