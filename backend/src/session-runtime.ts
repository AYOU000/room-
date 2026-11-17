import { randomUUID } from 'node:crypto';
import { AccessToken, RoomServiceClient, TrackSource } from 'livekit-server-sdk';
import { PrismaClient } from '@prisma/client';
import type { Express, RequestHandler } from 'express';
import type { Server } from 'node:http';
import { WebSocketServer, WebSocket } from 'ws';
import { PrismaRoomLifecycleService } from './room-lifecycle.js';
import { AppError } from './security-errors.js';
import { emptyBodySchema, validateBody, uuidSchema } from './security-validation.js';
import type { SecurityConfig } from './security-config.js';

export function sessionRuntime(db: PrismaClient, service: PrismaRoomLifecycleService, config: SecurityConfig) {
  const media = new RoomServiceClient(process.env.LIVEKIT_INTERNAL_URL ?? 'http://livekit:7880', config.livekitApiKey, config.livekitApiSecret);
  const roomName = (id: string) => `room_${id}`;
  const missingSince = new Map<string, number>();
  const sequences = new Map<string, number>();
  const clients = new Map<WebSocket, { user: string; session: string }>();
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
      const participant = session.participants.find(p => p.userId === user)!;
      if (!['WAITING', 'ACTIVE'].includes(session.state)) throw new AppError(409, 'STATE_CONFLICT');
      if (!participant.consentAt || participant.consentVersion !== (process.env.CONSENT_VERSION ?? 'privacy-v1')) throw new AppError(403, 'FORBIDDEN');
      const token = new AccessToken(config.livekitApiKey, config.livekitApiSecret, { identity: user, ttl: '5m' });
      token.addGrant({ roomJoin: true, room: roomName(id), canPublish: session.state === 'ACTIVE', canPublishSources: [TrackSource.MICROPHONE], canSubscribe: true, canPublishData: false, canUpdateOwnMetadata: false, roomAdmin: false, roomRecord: false });
      return { sessionId: id, participantId: user, roomName: roomName(id), grantMode: session.state === 'ACTIVE' ? 'active' : 'preflight', token: await token.toJwt(), serverUrl: config.livekitPublicUrl };
    });
  }
  function routes(app: Express, authenticate: RequestHandler) {
    app.post('/api/sessions/:sessionId/media-token', authenticate, validateBody(emptyBodySchema), async (req, res) => {
      const id = uuidSchema.parse(req.params.sessionId);
      res.json(await humanToken(id, res.locals.authenticatedUserId));
    });
  }
  // Server-only API: never mount this function on a browser-accessible route.
  async function asrToken(id: string) {
    const session = await db.debateSession.findUnique({ where: { id } });
    if (session?.state !== 'ACTIVE') throw new AppError(409, 'STATE_CONFLICT');
    const token = new AccessToken(config.livekitApiKey, config.livekitApiSecret, { identity: `asr_${id}`, ttl: '5m' });
    token.addGrant({ roomJoin: true, room: roomName(id), canPublish: false, canSubscribe: true, canPublishData: false, canUpdateOwnMetadata: false, roomAdmin: false, roomRecord: false });
    return token.toJwt();
  }
  function broadcast(id: string, type: string, payload: unknown) {
    const sequence = (sequences.get(id) ?? 0) + 1;
    sequences.set(id, sequence);
    const event = JSON.stringify({ event_id: randomUUID(), session_id: id, type, sequence, server_time: new Date().toISOString(), payload });
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
      const sessions = await db.debateSession.findMany({ where: { state: { in: ['WAITING', 'ACTIVE', 'FINISHING'] } }, include: { room: true, participants: true } });
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
              await service.markAudioConnection(session.id, participant.userId, present);
              const key = `${session.id}:${participant.userId}`;
              if (present) missingSince.delete(key);
              else if (current.state === 'ACTIVE') {
                const since = missingSince.get(key) ?? now.getTime();
                missingSince.set(key, since);
                if (now.getTime() - since >= 60000) await service.endSession(session.id, 'DISCONNECT', now);
              }
            }
          }
          current = await db.debateSession.findUniqueOrThrow({ where: { id: session.id } });
          if (current.state === 'FINISHING' || current.state === 'CANCELLED') {
            await media.deleteRoom(roomName(session.id)).catch(error => {
              if (error?.code !== 'not_found' && error?.status !== 404) throw error;
            });
            // No transcript/evaluator implementation exists yet: never imply evaluation succeeded.
            await db.debateSession.updateMany({ where: { id: session.id, evaluationStatus: 'PENDING' }, data: { evaluationStatus: 'UNAVAILABLE' } });
            await service.completeFinalization(session.id);
          }
          const snapshot = await service.readRoom(session.roomId, session.room.creatorId, now);
          broadcast(session.id, 'session.state', snapshot);
        } catch {
          // A failed media dependency cannot leave an active discussion running indefinitely.
          await service.endSession(session.id, 'SERVICE_FAILURE', now);
        }
      }
    } finally { busy = false; }
  }
  function attach(server: Server, verify: (header?: string) => Promise<string>) {
    const wss = new WebSocketServer({ server, path: '/api/events', maxPayload: 16384, verifyClient: (info: { origin: string }) => config.allowedOrigins.includes(info.origin) });
    wss.on('connection', socket => {
      const timeout = setTimeout(() => socket.close(1008), 5000);
      socket.once('message', async data => {
        try {
          const input = JSON.parse(data.toString());
          const user = await verify(input.authorization);
          const session = uuidSchema.parse(input.session_id);
          await member(session, user);
          clients.set(socket, { user, session });
          clearTimeout(timeout);
        } catch { socket.close(1008); }
      });
      socket.on('close', () => { clearTimeout(timeout); clients.delete(socket); });
    });
    const timer = setInterval(() => void tick().catch(() => console.error('Session reconciliation failed')), 1000);
    timer.unref();
    server.on('close', () => { clearInterval(timer); wss.close(); });
    void tick().catch(() => console.error('Session recovery failed'));
  }
  return { routes, attach, asrToken, tick };
}
