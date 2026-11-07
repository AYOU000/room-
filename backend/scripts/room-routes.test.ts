import { describe, expect, it, vi } from "vitest";
import request from "supertest";
import type { RequestHandler } from "express";
import { createApp } from "../src/app.js";
import { loadSecurityConfig } from "../src/security-config.js";
import type { RoomLifecycleService, RoomSnapshot } from "../src/room-lifecycle.js";

const creatorId = "4c5f92d6-91bb-41ce-bde6-35c8a8187a0d";
const roomId = "f930dd7e-194a-4694-900d-e030e7a54e8b";
const sessionId = "c78a7115-7272-4055-98d9-b30235f09980";
const now = new Date("2026-11-07T09:00:00.000Z");

const snapshot: RoomSnapshot = {
  room: { id: roomId, status: "waiting", creatorId, title: "A valid debate topic", description: null, durationSeconds: 600 },
  session: { id: sessionId, state: "waiting", evaluationStatus: "pending", startedAt: null, endsAt: null, endedAt: null, endReason: null, serverTime: now },
  participants: [{ participantId: creatorId, slot: 1, ready: false, consentVersion: null, connection: "disconnected" }],
};

function createService(): RoomLifecycleService {
  return {
    createRoom: vi.fn(async () => ({ snapshot, inviteCode: "A".repeat(43) })),
    joinRoom: vi.fn(async () => snapshot),
    updateRoom: vi.fn(async () => snapshot),
    setReady: vi.fn(async () => snapshot),
    startRoom: vi.fn(async () => snapshot),
    finishSession: vi.fn(async () => ({ ...snapshot, session: { ...snapshot.session, state: "finishing", endReason: "user_end", endedAt: now } })),
    markAudioConnection: vi.fn(async () => {}),
  };
}

const authenticate: RequestHandler = (_req, res, next) => {
  res.locals.authenticatedUserId = creatorId;
  next();
};

function testApp(service: RoomLifecycleService, auth?: RequestHandler) {
  return createApp({
    config: loadSecurityConfig({ NODE_ENV: "test" }),
    roomService: service,
    authenticateUser: auth,
    audit: () => {},
    consentVersion: "privacy-v1",
    now: () => now,
  });
}

describe("room lifecycle routes", () => {
  it("fails closed until Member 1 provides authentication", async () => {
    const service = createService();
    const response = await request(testApp(service))
      .post("/api/rooms").send({ title: "A valid debate topic" });
    expect(response.status).toBe(503);
    expect(response.body.error.code).toBe("SERVICE_UNAVAILABLE");
    expect(service.createRoom).not.toHaveBeenCalled();
  });

  it("leaves unrelated paths to the shared not-found handler", async () => {
    const response = await request(testApp(createService())).get("/not-a-room-route");
    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe("NOT_FOUND");
  });

  it("creates a waiting room and returns the one-time invite code", async () => {
    const service = createService();
    const response = await request(testApp(service, authenticate)).post("/api/rooms")
      .send({ title: "A valid debate topic" });
    expect(response.status).toBe(201);
    expect(response.body.inviteCode).toHaveLength(43);
    expect(service.createRoom).toHaveBeenCalledWith({
      creatorId,
      title: "A valid debate topic",
      description: undefined,
      durationSeconds: 600,
      now,
    });
  });

  it("rejects invalid and unknown request fields using Member 5 schemas", async () => {
    const service = createService();
    const response = await request(testApp(service, authenticate)).post("/api/rooms")
      .send({ title: "short", creatorId, isAdmin: true });
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("INVALID_INPUT");
    expect(service.createRoom).not.toHaveBeenCalled();
  });

  it("routes join and update through authenticated identity and validated input", async () => {
    const service = createService();
    const joined = await request(testApp(service, authenticate)).post("/api/rooms/join")
      .send({ inviteCode: "B".repeat(43) });
    expect(joined.status).toBe(200);
    expect(service.joinRoom).toHaveBeenCalledWith(creatorId, "B".repeat(43), now);

    const updated = await request(testApp(service, authenticate)).patch(`/api/rooms/${roomId}`)
      .send({ title: "An updated debate topic", durationSeconds: 900 });
    expect(updated.status).toBe(200);
    expect(service.updateRoom).toHaveBeenCalledWith(
      roomId, creatorId, { title: "An updated debate topic", durationSeconds: 900 }, now,
    );
  });

  it("requires the configured consent version before ready and start", async () => {
    const service = createService();
    const mismatch = await request(testApp(service, authenticate)).post(`/api/rooms/${roomId}/ready`)
      .send({ consentVersion: "old-version", ready: true });
    expect(mismatch.status).toBe(409);
    expect(mismatch.body.error.code).toBe("STATE_CONFLICT");
    expect(service.setReady).not.toHaveBeenCalled();

    const ready = await request(testApp(service, authenticate)).post(`/api/rooms/${roomId}/ready`)
      .send({ consentVersion: "privacy-v1", ready: true });
    expect(ready.status).toBe(200);
    expect(service.setReady).toHaveBeenCalledWith(roomId, creatorId, "privacy-v1", true, now);

    const start = await request(testApp(service, authenticate)).post(`/api/rooms/${roomId}/start`).send({});
    expect(start.status).toBe(200);
    expect(service.startRoom).toHaveBeenCalledWith(roomId, creatorId, "privacy-v1", now);
  });

  it("routes finish through the authenticated member and rejects malformed IDs", async () => {
    const service = createService();
    const finished = await request(testApp(service, authenticate)).post(`/api/sessions/${sessionId}/finish`).send({});
    expect(finished.status).toBe(200);
    expect(finished.body.session.state).toBe("finishing");
    expect(service.finishSession).toHaveBeenCalledWith(sessionId, creatorId, now);

    const invalid = await request(testApp(service, authenticate)).post("/api/sessions/not-a-uuid/finish").send({});
    expect(invalid.status).toBe(400);
    expect(invalid.body.error.code).toBe("INVALID_INPUT");
    expect(service.finishSession).toHaveBeenCalledTimes(1);
  });
});
