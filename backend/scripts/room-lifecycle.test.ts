import { describe, it, expect } from 'vitest';
import type { PrismaClient } from '@prisma/client';
import { PrismaRoomLifecycleService } from '../src/room-lifecycle.js';

// In-memory transaction adapter exercises service policy; not database locking evidence.
function setup() {
 const now = new Date('2026-11-17T10:00:00Z');
 const participants = ['creator', 'guest'].map((userId, i) => ({ userId, slot: i+1, isReady: true, consentAt: now, consentVersion: 'privacy-v1', audioConnected: true, microphoneReady: true, audioObservedAt: now }));
 const session = { id: 'session', roomId: 'room', state: 'WAITING', endReason: null, startedAt: null, endsAt: null, endedAt: null, evaluationStatus: 'PENDING', durationSeconds: 600, participants } as any;
 const room = { id: 'room', creatorId: 'creator', title: 'Topic', description: null, durationSeconds: 600, status: 'WAITING', inviteExpiresAt: new Date(now.getTime()+86400000), session };
 const db: any = {
  $queryRaw: async () => [{ id: 'room' }],
  sessionParticipant: {
   create: async ({data}: any) => { session.participants.push({ ...data, isReady: false, consentAt: null, consentVersion: null, audioConnected: false }); },
   delete: async ({where}: any) => { session.participants = session.participants.filter((p: any) => p.userId !== where.sessionId_userId.userId); },
   updateMany: async ({data}: any) => { session.participants.forEach((p: any) => Object.assign(p, data)); return { count: session.participants.length }; },
  },
  room: { findUnique: async () => room, update: async ({data}: any) => Object.assign(room, data) },
  debateSession: {
   findUnique: async () => session,
   update: async ({data}: any) => Object.assign(session, data),
   updateMany: async ({where, data}: any) => { if (session.state === where.state) Object.assign(session, data); return { count: 1 }; },
  },
 };
 db.$transaction = async (fn: any) => fn(db);
 return { service: new PrismaRoomLifecycleService(db as PrismaClient), room, session, participants, now };
}
describe('room lifecycle policy', () => {
 it('requires the creator and two ready consented humans with fresh usable audio', async () => {
  const {service, participants, now} = setup();
  await expect(service.startRoom('room','guest','privacy-v1',now)).rejects.toMatchObject({code:'FORBIDDEN'});
  participants[1].microphoneReady = false;
  await expect(service.startRoom('room','creator','privacy-v1',now)).rejects.toMatchObject({code:'AUDIO_NOT_CONNECTED'});
  participants[1].microphoneReady = true;
  participants[1].consentVersion = 'old';
  await expect(service.startRoom('room','creator','privacy-v1',now)).rejects.toMatchObject({code:'NOT_READY'});
  participants[1].consentVersion = 'privacy-v1';
  participants[1].audioObservedAt = new Date(now.getTime()-6000);
  await expect(service.startRoom('room','creator','privacy-v1',now)).rejects.toMatchObject({code:'AUDIO_NOT_CONNECTED'});
 });
 it('starts once, preserves deadline, finishes once and ends independently of evaluation', async () => {
  const {service,session,now} = setup();
  await service.startRoom('room','creator','privacy-v1',now);
  const deadline = session.endsAt;
  await service.startRoom('room','creator','privacy-v1',new Date(now.getTime()+1000));
  expect(session.endsAt).toEqual(deadline);
  await service.finishSession('session','guest',now);
  await service.endSession('session','SERVICE_FAILURE',new Date(now.getTime()+2000));
  expect(session.endReason).toBe('USER_END');
  expect(session.state).toBe('FINISHING');
  await service.completeFinalization('session');
  expect(session.state).toBe('ENDED');
  expect(session.evaluationStatus).toBe('PENDING');
 });
 it.each(['TIMER','DISCONNECT','SERVICE_FAILURE'] as const)('records trusted %s reason', async reason => {
  const {service,session,now} = setup();
  await service.startRoom('room','creator','privacy-v1',now);
  await service.endSession('session',reason,new Date(now.getTime()+600000));
  expect(session.endReason).toBe(reason);
  expect(session.state).toBe('FINISHING');
 });
 it('does not fire the timer early or let a nonmember read state', async () => {
  const {service,session,now} = setup();
  await service.startRoom('room','creator','privacy-v1',now);
  await service.endSession('session','TIMER',now);
  expect(session.state).toBe('ACTIVE');
  await expect(service.readRoom('room','outsider',now)).rejects.toMatchObject({code:'NOT_FOUND'});
 });
 it('cancels only a waiting room and never restarts it', async () => {
  const {service,session,now} = setup();
  await expect(service.cancelRoom('room','guest',now)).rejects.toMatchObject({code:'FORBIDDEN'});
  await service.cancelRoom('room','creator',now);
  await service.cancelRoom('room','creator',now);
  await service.startRoom('room','creator','privacy-v1',now);
  expect(session.state).toBe('CANCELLED');
 });
});

describe('waiting-room admission and departure', () => {
 it('releases the guest slot and admits a different account, clearing readiness', async () => {
  const { service, session, now } = setup();
  await service.leaveRoom('room', 'guest', now);
  expect(session.participants).toHaveLength(1);
  expect(session.participants[0].isReady).toBe(false);
  await expect(service.readRoom('room','guest',now)).rejects.toMatchObject({code:'NOT_FOUND'});
  const joined = await service.joinRoom('replacement','invite',now);
  expect(joined.participants.map(p => p.participantId)).toEqual(['creator','replacement']);
  expect(joined.participants[1].slot).toBe(2);
 });
 it('rejects full, expired and closed invitations and creator self-join', async () => {
  const { service, room, now } = setup();
  await expect(service.joinRoom('third','invite',now)).rejects.toMatchObject({code:'ROOM_FULL'});
  await expect(service.joinRoom('creator','invite',now)).rejects.toMatchObject({code:'STATE_CONFLICT'});
  expect((await service.joinRoom('guest','invite',now)).participants).toHaveLength(2);
  room.inviteExpiresAt = now;
  await expect(service.joinRoom('third','invite',now)).rejects.toMatchObject({code:'INVITE_INVALID'});
 });
 it('creator departure cancels and invalidates admission', async () => {
  const { service, session, now } = setup();
  await service.leaveRoom('room','creator',now);
  expect(session.state).toBe('CANCELLED');
  await expect(service.joinRoom('third','invite',now)).rejects.toMatchObject({code:'INVITE_INVALID'});
 });
 it('rejects active departures and noncreator edits, resets both acknowledgements on edit', async () => {
  const { service, session, now } = setup();
  await expect(service.updateRoom('room','guest',{title:'New topic'},now)).rejects.toMatchObject({code:'FORBIDDEN'});
  await service.updateRoom('room','creator',{title:'New topic',durationSeconds:900},now);
  expect(session.participants.every((p: any) => !p.isReady)).toBe(true);
  expect(session.topicSnapshot).toBe('New topic');
  session.state = 'ACTIVE';
  await expect(service.leaveRoom('room','guest',now)).rejects.toMatchObject({code:'STATE_CONFLICT'});
  await expect(service.updateRoom('room','creator',{title:'Another topic'},now)).rejects.toMatchObject({code:'STATE_CONFLICT'});
 });
});
