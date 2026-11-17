import { sessionEventSchema } from './room-contracts.js';
import { z } from 'zod';
import { randomUUID } from 'node:crypto';
import { AccessToken, RoomServiceClient, TrackSource } from 'livekit-server-sdk';
import { PrismaClient } from '@prisma/client';
import type { Express, RequestHandler } from 'express';
import type { Server } from 'node:http';
import { WebSocketServer, WebSocket } from 'ws';
import { PrismaRoomLifecycleService } from './room-lifecycle.js';
import { AppError } from './security-errors.js';
import { emptyBodySchema, validateBody, uuidSchema, parseInput, parseEvent } from './security-validation.js';
import type { SecurityConfig } from './security-config.js';

export function sessionRuntime(db: PrismaClient, service: PrismaRoomLifecycleService, config: SecurityConfig) {
  const media = new RoomServiceClient(process.env.LIVEKIT_INTERNAL_URL ?? 'http://livekit:7880', config.livekitApiKey, config.livekitApiSecret);
  const roomName = (id: string) => `room_${id}`;
  const clients = new Map<WebSocket, { user: string; session: string; authorization: string; alive: boolean }>();
  async function member(sessionId: string, user: string) {
    const session = await db.debateSession.findUnique({ where: { id: sessionId }, include: { participants: true } });
    const participant = session?.participants.find(p => p.userId === user);
    if (!session || !participant) throw new AppError(404, 'NOT_FOUND');
    return { session, participant };
  }
  async function humanToken(id: string, user: string) {
    return db.$transaction(async tx => {
      const initial = await member(id, user);
      await tx.$queryRaw`SELECT id FROM rooms WHERE id = ${initial.session.roomId}::uuid FOR UPDATE`;
      const session = await tx.debateSession.findUniqueOrThrow({ where: { id }, include: { participants: true } });
      const participant = session.participants.find(p => p.userId === user);
      if (!participant) throw new AppError(404, 'NOT_FOUND');
      if (!['WAITING', 'ACTIVE'].includes(session.state)) throw new AppError(409, 'STATE_CONFLICT');
      if (!participant.consentAt || participant.consentVersion !== (process.env.CONSENT_VERSION ?? 'privacy-v1')) throw new AppError(403, 'FORBIDDEN');
      const token = new AccessToken(config.livekitApiKey, config.livekitApiSecret, { identity: user, ttl: '5m' });
      token.addGrant({ roomJoin: true, room: roomName(id), canPublish: session.state === 'ACTIVE', canPublishSources: [TrackSource.MICROPHONE], canSubscribe: true, canPublishData: false, canUpdateOwnMetadata: false, roomAdmin: false, roomRecord: false });
      await tx.debateSession.update({ where: { id }, data: { mediaGrantExpiresAt: new Date(Date.now() + 300000), mediaClosed: false } });
      return { sessionId: id, participantId: user, roomName: roomName(id), grantMode: session.state === 'ACTIVE' ? 'active' : 'preflight', token: await token.toJwt(), serverUrl: config.livekitPublicUrl };
    });
  }
  const preflightSchema = z.strictObject({ microphoneReady: z.boolean() });
  function routes(app: Express, authenticate: RequestHandler) {
    app.post('/api/sessions/:sessionId/audio-preflight', authenticate, validateBody(preflightSchema), async (req, res) => {
      const id = parseInput(uuidSchema, req.params.sessionId);
      const user = res.locals.authenticatedUserId as string;
      const { session } = await member(id, user);
      if (!['WAITING', 'ACTIVE'].includes(session.state)) throw new AppError(409, 'STATE_CONFLICT');
      const connected = await media.listParticipants(roomName(id));
      if (!connected.some(p => p.identity === user)) throw new AppError(409, 'AUDIO_NOT_CONNECTED');
      await db.sessionParticipant.updateMany({ where: { sessionId: id, userId: user, session: { state: { in: ['WAITING', 'ACTIVE'] } } }, data: { microphoneReady: req.body.microphoneReady, audioConnected: true, audioObservedAt: new Date() } });
      res.status(204).end();
    });
    app.post('/api/sessions/:sessionId/media-token' , authenticate, validateBody(emptyBodySchema), async (req, res) => {
      const id = parseInput(uuidSchema, req.params.sessionId);
      res.json(await humanToken(id, res.locals.authenticatedUserId));
    });
  }
  // Server-only API: never mount this function on a browser-accessible route.
  async function asrToken(id: string) {
    return db.$transaction(async tx => {
      const initial = await tx.debateSession.findUnique({ where: { id } });
      if (!initial) throw new AppError(404, 'NOT_FOUND');
      await tx.$queryRaw`SELECT id FROM rooms WHERE id = ${initial.roomId}::uuid FOR UPDATE`;
      const session = await tx.debateSession.findUniqueOrThrow({ where: { id } });
      if (session.state !== 'ACTIVE') throw new AppError(409, 'STATE_CONFLICT');
      const token = new AccessToken(config.livekitApiKey, config.livekitApiSecret, { identity: `asr_${id}`, ttl: '5m' });
      token.addGrant({ roomJoin: true, room: roomName(id), canPublish: false, canSubscribe: true, canPublishData: false, canUpdateOwnMetadata: false, roomAdmin: false, roomRecord: false });
      await tx.debateSession.update({ where: { id }, data: { mediaGrantExpiresAt: new Date(Date.now() + 300000), mediaClosed: false } });
      return token.toJwt();
    });
  }
  async function broadcast(id: string, type: string, payload: unknown) {
    const row = await db.debateSession.update({ where: { id }, data: { eventSequence: { increment: 1 } }, select: { eventSequence: true } });
    const sequence = row.eventSequence;
    const event = JSON.stringify(sessionEventSchema.parse({ event_id: randomUUID(), session_id: id, type, sequence, server_time: new Date().toISOString(), payload }));
    for (const [socket, subscription] of clients) if (subscription.session === id && socket.readyState === WebSocket.OPEN) {
      if (socket.bufferedAmount > 65536) socket.close(1013); else socket.send(event);
    }
  }
  let busy = false;
  async function tick() {
    if (busy) return;
    busy = true;
    try {
      const now = new Date();
      const sessions = await db.debateSession.findMany({ where: { OR: [{ state: { in: ['WAITING', 'ACTIVE', 'FINISHING'] } }, { state: { in: ['ENDED', 'CANCELLED'] }, mediaClosed: false }] }, include: { room: true, participants: true } });
      for (const session of sessions) {
        try {
          if (session.state === 'WAITING' && session.room.inviteExpiresAt <= now) await service.cancelRoom(session.roomId, session.room.creatorId, now);
          if (session.state === 'ACTIVE' && session.endsAt && session.endsAt <= now) await service.endSession(session.id, 'TIMER', now);
          let current = await db.debateSession.findUniqueOrThrow({ where: { id: session.id } });
          if (current.state === 'WAITING' || current.state === 'ACTIVE') {
            const connected = await media.listParticipants(roomName(session.id)).catch(error => {
              if (error?.code === 'not_found' || error?.status === 404) return [];
              throw error;
            });
            for (const participant of session.participants) {
              const present = connected.some(p => p.identity === participant.userId);
              if (current.state === 'ACTIVE' && participant.disconnectDeadline && participant.disconnectDeadline <= now) {
                await service.endSession(session.id, 'DISCONNECT', now);
                break;
              }
              await service.markAudioConnection(session.id, participant.userId, present);
              if (!present && current.state === 'ACTIVE') {
                await db.sessionParticipant.updateMany({ where: { id: participant.id, disconnectDeadline: null, audioConnected: false }, data: { disconnectDeadline: new Date(now.getTime() + 60000) } });
                const observed = await db.sessionParticipant.findUniqueOrThrow({ where: { id: participant.id } });
                if (observed.disconnectDeadline && observed.disconnectDeadline <= now) await service.endSession(session.id, 'DISCONNECT', now);
              }
            }
          }
          current = await db.debateSession.findUniqueOrThrow({ where: { id: session.id } });
          if (['FINISHING', 'ENDED', 'CANCELLED'].includes(current.state)) {
            await media.deleteRoom(roomName(session.id)).catch(error => {
              if (error?.code !== 'not_found' && error?.status !== 404) throw error;
            });
            // No transcript/evaluator implementation exists yet: never imply evaluation succeeded.
            await db.debateSession.updateMany({ where: { id: session.id, evaluationStatus: 'PENDING' }, data: { evaluationStatus: 'UNAVAILABLE' } });
            await service.completeFinalization(session.id);
            // Keep closing a room recreated by an already-issued token until its grant expires.
            if (!current.mediaGrantExpiresAt || current.mediaGrantExpiresAt <= now) await db.debateSession.update({ where: { id: session.id }, data: { mediaClosed: true } });
          }
          const snapshot = await service.readRoom(session.roomId, session.room.creatorId, now);
          await broadcast(session.id, 'session.state', snapshot);
        } catch {
          // A failed media dependency cannot leave an active discussion running indefinitely.
          await service.endSession(session.id, 'SERVICE_FAILURE', now);
          if (session.state === 'FINISHING') await service.completeFinalization(session.id);
        }
      }
    } finally { busy = false; }
  }
  function attach(server: Server, verify: (header?: string) => Promise<string>) {
    const wss = new WebSocketServer({ server, path: '/api/events', maxPayload: 16384, verifyClient: (info: { origin: string }) => config.allowedOrigins.includes(info.origin) });
    wss.on('connection', socket => {
      if (wss.clients.size > 100) { socket.close(1013); return; }
      socket.on('error', () => socket.terminate());
      socket.on('pong', () => { const c = clients.get(socket); if (c) c.alive = true; });
      const timeout = setTimeout(() => socket.close(1008), 5000);
      let received = false;
      socket.on('message', async data => {
        if (received) { socket.close(1008); return; }
        received = true;
        try {
          const input = parseEvent(z.strictObject({ authorization: z.string().min(8).max(8192), session_id: uuidSchema }), data.toString());
          const user = await verify(input.authorization);
          const session = uuidSchema.parse(input.session_id);
          await member(session, user);
          if ([...clients.values()].filter(c => c.user === user).length >= 4) throw new AppError(429, 'RATE_LIMITED');
          clients.set(socket, { user, session, authorization: input.authorization, alive: true });
          const { session: state } = await member(session, user);
          await broadcast(session, 'session.state', await service.readRoom(state.roomId, user, new Date()));
          clearTimeout(timeout);
        } catch { socket.close(1008); }
      });
      socket.on('close', () => { clearTimeout(timeout); clients.delete(socket); });
    });
    const heartbeat = setInterval(() => {
      for (const [socket, client] of clients) {
        if (!client.alive) { socket.terminate(); continue; }
        client.alive = false;
        void verify(client.authorization).then(() => member(client.session, client.user)).then(() => socket.ping()).catch(() => socket.close(1008));
      }
    }, 15000);
    heartbeat.unref();
    const timer = setInterval(() => void tick().catch(() => console.error('Session reconciliation failed')), 1000);
    timer.unref();
    server.on('close', () => { clearInterval(timer); clearInterval(heartbeat); for (const socket of wss.clients) socket.terminate(); wss.close(); });
    void tick().catch(() => console.error('Session recovery failed'));
  }
  return { routes, attach, asrToken, tick };
}
