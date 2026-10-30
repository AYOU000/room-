import { describe, it, expect } from "vitest";
import request from "supertest";
import express from "express";
import { TokenVerifier } from "livekit-server-sdk";
import { createApp, type AuditRecord } from "../src/app.js";
import { loadSecurityConfig } from "../src/security/config.js";
import { AppError, errorHandler } from "../src/security/errors.js";
import { csrfProtection, requestContext } from "../src/security/http.js";
import { createRateLimiter } from "../src/security/rate-limit.js";
import { createRoomSchema, historyQuerySchema, parseEvent, parseInput, registrationSchema } from "../src/security/validation.js";

const config = () => loadSecurityConfig({
  NODE_ENV: "test", LIVEKIT_API_KEY: "test-key",
  LIVEKIT_API_SECRET: "synthetic-test-key-for-local-tests-only",
});
const body = { roomName: "debate-1", identity: "participant-1" };
const app = (extra: Parameters<typeof createApp>[0] = {}) => createApp({ config: config(), audit: () => {}, ...extra });

describe("HTTP security boundary", () => {
  it("returns health without server fingerprint and with defensive headers", async () => {
    const response = await request(app()).get("/health");
    expect(response.status).toBe(200);
    expect(response.body.status).toBe("ok");
    expect(response.headers["x-powered-by"]).toBeUndefined();
    expect(response.headers["content-security-policy"]).toContain("frame-ancestors 'none'");
    expect(response.headers["cache-control"]).toBe("no-store");
    expect(response.headers["permissions-policy"]).toContain("camera=()");
  });
  it.each([
    {}, { ...body, roomName: 123 }, { ...body, identity: "a".repeat(65) },
    { ...body, roomName: "' OR 1=1 --" }, { ...body, identity: "<script>alert(1)</script>" },
    { ...body, role: "admin" }, { ...body, transcript: "injected" },
    { ...body, __proto__: { admin: true }, constructor: "pollution" },
  ])("rejects malformed or extra mutation fields: %j", async (input) => {
    const response = await request(app()).post("/api/rooms/token").send(input);
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("INVALID_INPUT");
    expect(response.body).not.toHaveProperty("stack");
  });
  it("rejects malformed JSON with a safe request ID", async () => {
    const response = await request(app()).post("/api/rooms/token")
      .set("X-Request-ID", "untrusted-marker").set("Content-Type", "application/json")
      .send('{"password":"private-marker",');
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("INVALID_JSON");
    expect(response.body.requestId).toMatch(/^[0-9a-f-]{36}$/);
    expect(response.headers["x-request-id"]).toBe(response.body.requestId);
    expect(JSON.stringify(response.body)).not.toMatch(/private-marker|untrusted-marker|SyntaxError|stack/);
  });
  it("enforces the body limit before route processing", async () => {
    const response = await request(app()).post("/api/rooms/token").send({ ...body, text: "x".repeat(17_000) });
    expect(response.status).toBe(413);
    expect(response.body.error.code).toBe("PAYLOAD_TOO_LARGE");
  });
  it.each(["text/plain", "application/x-www-form-urlencoded"])("rejects %s", async (contentType) => {
    const response = await request(app()).post("/api/rooms/token").set("Content-Type", contentType).send("a=b");
    expect(response.status).toBe(415);
  });
  it("rejects compressed bodies", async () => {
    const response = await request(app()).post("/api/rooms/token").set("Content-Encoding", "gzip").send(body);
    expect(response.status).toBe(415);
  });
  it.each(["https://evil.invalid", "http://localhost:5173.evil.invalid", "null"])("blocks unapproved Origin %s", async (origin) => {
    const response = await request(app()).post("/api/rooms/token").set("Origin", origin).send(body);
    expect(response.status).toBe(403);
    expect(response.headers["access-control-allow-origin"]).toBeUndefined();
  });
  it("allows only the exact configured CORS origin", async () => {
    const response = await request(app()).options("/api/rooms/token")
      .set("Origin", "http://localhost:5173").set("Access-Control-Request-Method", "POST");
    expect(response.status).toBe(204);
    expect(response.headers["access-control-allow-origin"]).toBe("http://localhost:5173");
    expect(response.headers["access-control-allow-credentials"]).toBe("true");
  });
  it("logs metadata only, even for query strings, cookies, and unknown routes", async () => {
    const logs: AuditRecord[] = [];
    const server = app({ audit: (record) => logs.push(record) });
    await request(server).post("/api/rooms/token?secret=query-marker")
      .set("Authorization", "Bearer auth-marker").set("Cookie", "refresh=cookie-marker")
      .send({ ...body, transcript: "transcript-marker" });
    await request(server).get("/path-marker?transcript=transcript-marker");
    expect(logs).toHaveLength(2);
    expect(JSON.stringify(logs)).not.toMatch(/query-marker|auth-marker|cookie-marker|transcript-marker|path-marker/);
    expect(logs[1].route).toBe("unmatched");
  });
});

describe("media authorization and grants", () => {
  it("fails closed when authentication/membership integration is absent", async () => {
    const response = await request(app()).post("/api/rooms/token").send(body);
    expect(response.status).toBe(503);
    expect(response.body.error.code).toBe("MEDIA_AUTHORIZATION_UNAVAILABLE");
    expect(response.body.token).toBeUndefined();
  });
  it("uses the verified identity/room rather than browser choices", async () => {
    const response = await request(app({ authorizeMedia: async () => ({ identity: "verified-account", roomName: "authorized-room" }) }))
      .post("/api/rooms/token").send(body);
    expect(response.status).toBe(200);
    const jwt = await new TokenVerifier(config().livekitApiKey!, config().livekitApiSecret!).verify(response.body.token);
    expect(jwt.sub).toBe("verified-account");
    expect(jwt.video?.room).toBe("authorized-room");
    expect(jwt.video?.canPublishSources).toEqual(["microphone"]);
    expect(jwt.video?.canPublishData).toBe(false);
    expect(jwt.video?.roomAdmin).toBe(false);
    expect(jwt.exp! - jwt.nbf!).toBeLessThanOrEqual(300);
  });
  it.each([401, 403, 409] as const)("preserves authorizer denial %s", async (status) => {
    const code = status === 401 ? "UNAUTHENTICATED" : status === 403 ? "FORBIDDEN" : "STATE_CONFLICT";
    const response = await request(app({ authorizeMedia: async () => { throw new AppError(status, code); } }))
      .post("/api/rooms/token").send(body);
    expect(response.status).toBe(status);
    expect(response.body.error.code).toBe(code);
  });
  it("redacts unexpected provider errors", async () => {
    const response = await request(app({ authorizeMedia: async () => { throw new Error("private-provider-key"); } }))
      .post("/api/rooms/token").send(body);
    expect(response.status).toBe(500);
    expect(JSON.stringify(response.body)).not.toContain("private-provider-key");
  });
  it("rejects invalid trusted authorizer output", async () => {
    const response = await request(app({ authorizeMedia: async () => ({ ...body, roomName: "bad room" }) }))
      .post("/api/rooms/token").send(body);
    expect(response.status).toBe(503);
  });
  it("returns safe 503 when provider credentials are absent", async () => {
    const response = await request(app({ config: { ...config(), livekitApiSecret: undefined }, authorizeMedia: async () => body }))
      .post("/api/rooms/token").send(body);
    expect(response.status).toBe(503);
  });
  it("allows an explicitly enabled local-only prototype", async () => {
    const response = await request(app({ config: { ...config(), allowDevMediaTokens: true } }))
      .post("/api/rooms/token").send(body);
    expect(response.status).toBe(200);
  });
});

describe("configuration guardrails", () => {
  it.each([
    { NODE_ENV: "production", ENABLE_DEV_MEDIA_TOKENS: "true", ALLOWED_ORIGINS: "https://room.example", LIVEKIT_PUBLIC_URL: "wss://media.example" },
    { NODE_ENV: "production" },
    { ALLOWED_ORIGINS: "*" },
    { ALLOWED_ORIGINS: "https://room.example/path" },
    { NODE_ENV: "production", ALLOWED_ORIGINS: "http://room.example" },
    { NODE_ENV: "production", ALLOWED_ORIGINS: "https://room.example", LIVEKIT_PUBLIC_URL: "ws://media.example" },
    { RATE_LIMIT_IP_MAX: "NaN" }, { TRUSTED_PROXY_IPS: "true" },
    { ENABLE_DEV_MEDIA_TOKENS: "yes" },
  ])("rejects unsafe configuration %j", (env) => { expect(() => loadSecurityConfig(env)).toThrow(); });
});

describe("shared limits and future feature patterns", () => {
  it("limits clients despite spoofed X-Forwarded-For and returns Retry-After", async () => {
    const server = app({ config: { ...config(), ipLimit: 2 } });
    await request(server).post("/api/rooms/token").set("X-Forwarded-For", "1.1.1.1").send(body);
    await request(server).post("/api/rooms/token").set("X-Forwarded-For", "2.2.2.2").send(body);
    const response = await request(server).post("/api/rooms/token").set("X-Forwarded-For", "3.3.3.3").send(body);
    expect(response.status).toBe(429);
    expect(Number(response.headers["retry-after"])).toBeGreaterThan(0);
    expect((await request(server).get("/health")).status).toBe(200);
  });
  it("expires counters and rejects new keys when storage is saturated", async () => {
    let time = 0;
    const server = express(); server.use(requestContext(() => {}));
    server.use(createRateLimiter({ limit: 1, windowMs: 1000, maxKeys: 1, key: req => req.get("test-key")!, now: () => time }));
    server.get("/limited", (_req, res) => res.sendStatus(204)); server.use(errorHandler);
    expect((await request(server).get("/limited").set("test-key", "one")).status).toBe(204);
    expect((await request(server).get("/limited").set("test-key", "two")).status).toBe(429);
    time = 1001;
    expect((await request(server).get("/limited").set("test-key", "two")).status).toBe(204);
  });
  it("does not alter passwords or coerce numeric mutation fields", () => {
    const password = "  Unicode passphrase 漢字  ";
    expect(parseInput(registrationSchema, { email: "User@Example.com", displayName: " User ", password }).password).toBe(password);
    expect(parseInput(registrationSchema, { email: "User@Example.com", displayName: " User ", password }).email).toBe("user@example.com");
    expect(() => parseInput(createRoomSchema, { title: "A debate", durationSeconds: "600" })).toThrow(AppError);
    expect(() => parseInput(createRoomSchema, { title: "A debate", durationSeconds: 1801 })).toThrow(AppError);
    expect(parseInput(historyQuerySchema, { page: "2", limit: "50" })).toEqual({ page: 2, limit: 50 });
    expect(() => parseInput(historyQuerySchema, { limit: "100000" })).toThrow(AppError);
  });
  it("rejects oversized, malformed and unknown-field event frames", () => {
    expect(() => parseEvent(createRoomSchema, "x".repeat(16_385))).toThrow(AppError);
    expect(() => parseEvent(createRoomSchema, "{invalid")).toThrow(AppError);
    expect(() => parseEvent(createRoomSchema, '{"title":"A debate","admin":true}')).toThrow(AppError);
  });
  it.each([undefined, "short", "x".repeat(64)])("rejects missing/wrong CSRF tokens (%s)", async (actual) => {
    const server = express(); server.use(requestContext(() => {}));
    server.use(csrfProtection({ allowedOrigins: ["https://room.example"], expectedToken: () => "a".repeat(64) }));
    server.post("/refresh", (_req, res) => res.sendStatus(204)); server.use(errorHandler);
    const req = request(server).post("/refresh").set("Origin", "https://room.example");
    if (actual) req.set("X-CSRF-Token", actual);
    expect((await req).status).toBe(403);
  });
  it("accepts a session-bound CSRF token only with the right Origin", async () => {
    const server = express(); server.use(requestContext(() => {}));
    server.use(csrfProtection({ allowedOrigins: ["https://room.example"], expectedToken: () => "a".repeat(64) }));
    server.post("/refresh", (_req, res) => res.sendStatus(204)); server.use(errorHandler);
    expect((await request(server).post("/refresh").set("X-CSRF-Token", "a".repeat(64))).status).toBe(403);
    expect((await request(server).post("/refresh").set("Origin", "https://room.example").set("X-CSRF-Token", "a".repeat(64))).status).toBe(204);
  });
});
