import { createHash, randomBytes } from "node:crypto";
import type { RequestHandler } from "express";
import { Prisma, PrismaClient } from "@prisma/client";
import { AppError } from "./security-errors.js";

export type RoomSnapshot = {
  room: {
    id: string;
    status: string;
    creatorId: string;
    title: string;
    description: string | null;
    durationSeconds: number;
  };
  session: {
    id: string;
    state: string;
    evaluationStatus: string;
    startedAt: Date | null;
    endsAt: Date | null;
    endedAt: Date | null;
    endReason: string | null;
    serverTime: Date;
  };
  participants: Array<{
    participantId: string;
    slot: number;
    ready: boolean;
    consentVersion: string | null;
    connection: "connected" | "disconnected";
  }>;
};

export type CreateRoomInput = {
  creatorId: string;
  title: string;
  description?: string;
  durationSeconds: number;
  now: Date;
};

export interface RoomLifecycleService {
  createRoom(input: CreateRoomInput): Promise<{ snapshot: RoomSnapshot; inviteCode: string }>;
  joinRoom(userId: string, inviteCode: string, now: Date): Promise<RoomSnapshot>;
  updateRoom(roomId: string, userId: string, changes: { title?: string; description?: string; durationSeconds?: number }, now: Date): Promise<RoomSnapshot>;
  setReady(roomId: string, userId: string, consentVersion: string, ready: boolean, now: Date): Promise<RoomSnapshot>;
  startRoom(roomId: string, userId: string, consentVersion: string, now: Date): Promise<RoomSnapshot>;
  finishSession(sessionId: string, userId: string, now: Date): Promise<RoomSnapshot>;
  markAudioConnection(sessionId: string, userId: string, connected: boolean): Promise<void>;
}

const snapshotInclude = {
  session: { include: { participants: { orderBy: { slot: "asc" as const } } } },
};

type IncludedRoom = Prisma.RoomGetPayload<{ include: typeof snapshotInclude }>;

function toSnapshot(room: IncludedRoom, serverTime = new Date()): RoomSnapshot {
  if (!room.session) throw new AppError(503, "SERVICE_UNAVAILABLE");
  return {
    room: {
      id: room.id,
      status: room.status.toLowerCase(),
      creatorId: room.creatorId,
      title: room.title,
      description: room.description,
      durationSeconds: room.durationSeconds,
    },
    session: {
      id: room.session.id,
      state: room.session.state.toLowerCase(),
      evaluationStatus: room.session.evaluationStatus.toLowerCase(),
      startedAt: room.session.startedAt,
      endsAt: room.session.endsAt,
      endedAt: room.session.endedAt,
      endReason: room.session.endReason?.toLowerCase() ?? null,
      serverTime,
    },
    participants: room.session.participants.map((participant) => ({
      participantId: participant.userId,
      slot: participant.slot,
      ready: participant.isReady,
      consentVersion: participant.consentVersion,
      connection: participant.audioConnected ? "connected" : "disconnected",
    })),
  };
}

function hashInvite(code: string): string {
  return createHash("sha256").update(code).digest("hex");
}

function isPrismaCode(error: unknown, code: string): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === code;
}

export class PrismaRoomLifecycleService implements RoomLifecycleService {
  constructor(private readonly prisma: PrismaClient) {}

  private async lockRoom(tx: Prisma.TransactionClient, roomId: string): Promise<void> {
    await tx.$queryRaw`SELECT "id" FROM "rooms" WHERE "id" = ${roomId}::uuid FOR UPDATE`;
  }

  private async loadRoom(tx: Prisma.TransactionClient, roomId: string): Promise<IncludedRoom> {
    const room = await tx.room.findUnique({ where: { id: roomId }, include: snapshotInclude });
    if (!room) throw new AppError(404, "NOT_FOUND");
    return room;
  }

  private requireMember(room: IncludedRoom, userId: string): void {
    if (!room.session?.participants.some((participant) => participant.userId === userId)) {
      throw new AppError(404, "NOT_FOUND");
    }
  }

  async createRoom(input: CreateRoomInput): Promise<{ snapshot: RoomSnapshot; inviteCode: string }> {
    const inviteCode = randomBytes(32).toString("base64url");
    const inviteCodeHash = hashInvite(inviteCode);
    const room = await this.prisma.$transaction(async (tx) => {
      const created = await tx.room.create({
        data: {
          creatorId: input.creatorId,
          title: input.title,
          description: input.description,
          durationSeconds: input.durationSeconds,
          inviteCodeHash,
          inviteExpiresAt: new Date(input.now.getTime() + 24 * 60 * 60_000),
          session: {
            create: {
              topicSnapshot: input.title,
              durationSeconds: input.durationSeconds,
              participants: { create: { userId: input.creatorId, slot: 1 } },
            },
          },
        },
        include: snapshotInclude,
      });
      return created;
    });
    return { snapshot: toSnapshot(room, input.now), inviteCode };
  }

  async joinRoom(userId: string, inviteCode: string, now: Date): Promise<RoomSnapshot> {
    const inviteCodeHash = hashInvite(inviteCode);
    try {
      const room = await this.prisma.$transaction(async (tx) => {
        const rows = await tx.$queryRaw<Array<{ id: string }>>`
          SELECT "id" FROM "rooms" WHERE "inviteCodeHash" = ${inviteCodeHash} FOR UPDATE
        `;
        if (rows.length === 0) throw new AppError(404, "INVITE_INVALID");
        const current = await this.loadRoom(tx, rows[0].id);
        if (current.status !== "WAITING" || current.inviteExpiresAt <= now) {
          throw new AppError(404, "INVITE_INVALID");
        }
        if (current.creatorId === userId) throw new AppError(409, "STATE_CONFLICT");
        if (current.session?.participants.some((participant) => participant.userId === userId)) {
          return current;
        }
        if (current.session!.participants.length >= 2) throw new AppError(409, "ROOM_FULL");
        await tx.sessionParticipant.create({
          data: { sessionId: current.session!.id, userId, slot: 2 },
        });
        return this.loadRoom(tx, current.id);
      });
      return toSnapshot(room, now);
    } catch (error) {
      if (isPrismaCode(error, "P2002")) throw new AppError(409, "ROOM_FULL");
      throw error;
    }
  }

  async updateRoom(roomId: string, userId: string, changes: { title?: string; description?: string; durationSeconds?: number }, now: Date): Promise<RoomSnapshot> {
    return this.prisma.$transaction(async (tx) => {
      await this.lockRoom(tx, roomId);
      const room = await this.loadRoom(tx, roomId);
      this.requireMember(room, userId);
      if (room.creatorId !== userId) throw new AppError(403, "FORBIDDEN");
      if (room.status !== "WAITING" || room.session!.state !== "WAITING") throw new AppError(409, "STATE_CONFLICT");
      const title = changes.title ?? room.title;
      const durationSeconds = changes.durationSeconds ?? room.durationSeconds;
      await tx.room.update({
        where: { id: roomId },
        data: { ...changes, updatedAt: now },
      });
      await tx.debateSession.update({
        where: { id: room.session!.id },
        data: { topicSnapshot: title, durationSeconds },
      });
      await tx.sessionParticipant.updateMany({
        where: { sessionId: room.session!.id },
        data: { isReady: false },
      });
      return toSnapshot(await this.loadRoom(tx, roomId), now);
    });
  }

  async setReady(roomId: string, userId: string, consentVersion: string, ready: boolean, now: Date): Promise<RoomSnapshot> {
    return this.prisma.$transaction(async (tx) => {
      await this.lockRoom(tx, roomId);
      const room = await this.loadRoom(tx, roomId);
      this.requireMember(room, userId);
      if (room.status !== "WAITING" || room.session!.state !== "WAITING") throw new AppError(409, "STATE_CONFLICT");
      await tx.sessionParticipant.update({
        where: { sessionId_userId: { sessionId: room.session!.id, userId } },
        data: {
          isReady: ready,
          ...(ready ? { consentVersion, consentAt: now } : {}),
        },
      });
      return toSnapshot(await this.loadRoom(tx, roomId), now);
    });
  }

  async startRoom(roomId: string, userId: string, consentVersion: string, now: Date): Promise<RoomSnapshot> {
    return this.prisma.$transaction(async (tx) => {
      await this.lockRoom(tx, roomId);
      const room = await this.loadRoom(tx, roomId);
      this.requireMember(room, userId);
      if (room.creatorId !== userId) throw new AppError(403, "FORBIDDEN");
      const session = room.session!;
      if (session.state === "ACTIVE" || session.state === "FINISHING" || session.state === "ENDED") {
        return toSnapshot(room, now);
      }
      if (room.status !== "WAITING" || session.state !== "WAITING") throw new AppError(409, "STATE_CONFLICT");
      if (session.participants.length !== 2 || session.participants.some((participant) =>
        !participant.isReady || !participant.consentAt || participant.consentVersion !== consentVersion)) {
        throw new AppError(409, "NOT_READY");
      }
      if (session.participants.some((participant) => !participant.audioConnected)) {
        throw new AppError(409, "AUDIO_NOT_CONNECTED");
      }
      const endsAt = new Date(now.getTime() + session.durationSeconds * 1000);
      await tx.debateSession.update({
        where: { id: session.id },
        data: { state: "ACTIVE", startedAt: now, endsAt },
      });
      await tx.room.update({ where: { id: roomId }, data: { status: "ACTIVE", updatedAt: now } });
      return toSnapshot(await this.loadRoom(tx, roomId), now);
    });
  }

  async finishSession(sessionId: string, userId: string, now: Date): Promise<RoomSnapshot> {
    return this.prisma.$transaction(async (tx) => {
      const initial = await tx.debateSession.findUnique({ where: { id: sessionId }, select: { roomId: true } });
      if (!initial) throw new AppError(404, "NOT_FOUND");
      await this.lockRoom(tx, initial.roomId);
      const room = await this.loadRoom(tx, initial.roomId);
      this.requireMember(room, userId);
      const session = room.session!;
      if (session.state === "FINISHING" || session.state === "ENDED") return toSnapshot(room, now);
      if (session.state !== "ACTIVE") throw new AppError(409, "STATE_CONFLICT");
      await tx.debateSession.update({
        where: { id: session.id },
        data: { state: "FINISHING", endReason: "USER_END", endedAt: now },
      });
      await tx.room.update({ where: { id: room.id }, data: { status: "CLOSED", updatedAt: now } });
      return toSnapshot(await this.loadRoom(tx, room.id), now);
    });
  }

  async markAudioConnection(sessionId: string, userId: string, connected: boolean): Promise<void> {
    // Call only after verifying the LiveKit event signature and room/identity mapping.
    const result = await this.prisma.sessionParticipant.updateMany({
      where: { sessionId, userId, session: { state: { in: ["WAITING", "ACTIVE"] } } },
      data: { audioConnected: connected },
    });
    if (result.count === 0) throw new AppError(404, "NOT_FOUND");
  }
}

export type AuthenticatedRequestHandler = RequestHandler;

/** Member 1 replaces this fail-closed integration point with verified auth. */
export const authenticateMember1: AuthenticatedRequestHandler = (_req, _res, next) => {
  next(new AppError(503, "SERVICE_UNAVAILABLE"));
};
