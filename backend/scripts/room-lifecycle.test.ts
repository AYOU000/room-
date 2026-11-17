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
  $queryRaw: async () => [],
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
