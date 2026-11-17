import { describe, expect, it } from 'vitest';
import { sessionEventSchema, sessionStateSchema, endReasonSchema } from '../src/room-contracts.js';
import { sessionAuth } from '../src/session-auth.js';

const id = '4c5f92d6-91bb-41ce-bde6-35c8a8187a0d';
const snapshot = {
 room: { id, status: 'waiting', creatorId: id, title: 'Example topic', description: null, durationSeconds: 600 },
 session: { id, state: 'waiting', evaluationStatus: 'pending', startedAt: null, endsAt: null, endedAt: null, endReason: null, serverTime: new Date() },
 participants: [{ participantId: id, slot: 1, ready: false, consentVersion: null, connection: 'disconnected' }],
};
const event = { event_id: id, session_id: id, type: 'session.state', sequence: 1, server_time: new Date().toISOString(), payload: snapshot };
describe('room wire contracts', () => {
 it('accepts the exact snake_case envelope and serializes a snapshot', () => {
   expect(sessionEventSchema.safeParse(JSON.parse(JSON.stringify(event))).success).toBe(true);
 });
 it('rejects camelCase aliases, unknown fields and invalid ordering metadata', () => {
   expect(sessionEventSchema.safeParse({ ...event, eventId: id }).success).toBe(false);
   expect(sessionEventSchema.safeParse({ ...event, sequence: -1 }).success).toBe(false);
   expect(sessionEventSchema.safeParse({ ...event, server_time: 'yesterday' }).success).toBe(false);
 });
 it('rejects cross-session payloads and a third human', () => {
   expect(sessionEventSchema.safeParse({ ...event, session_id: 'c78a7115-7272-4055-98d9-b30235f09980' }).success).toBe(false);
   expect(sessionEventSchema.safeParse({ ...event, payload: { ...snapshot, participants: Array(3).fill(snapshot.participants[0]) } }).success).toBe(false);
 });
 it('keeps evaluation states and phases out of session state', () => {
   for (const state of ['processing', 'completed', 'solo', 'open']) expect(sessionStateSchema.safeParse(state).success).toBe(false);
   for (const reason of ['timer', 'user_end', 'disconnect', 'service_failure']) expect(endReasonSchema.safeParse(reason).success).toBe(true);
 });
 it('fails closed without identity-provider configuration', async () => {
   await expect(sessionAuth({}).verify('Bearer fake')).rejects.toMatchObject({ status: 503 });
   expect(() => sessionAuth({ AUTH_JWKS_URL: 'http://example.com/keys' })).toThrow();
 });
});

import { createRoomSchema } from '../src/security-validation.js';
describe('room creation field boundaries', () => {
 it('defaults to ten minutes and accepts inclusive limits', () => {
  expect(createRoomSchema.parse({title:'12345'}).durationSeconds).toBe(600);
  expect(createRoomSchema.safeParse({title:'x'.repeat(200),description:'x'.repeat(2000),durationSeconds:1800}).success).toBe(true);
  expect(createRoomSchema.safeParse({title:'12345',durationSeconds:120}).success).toBe(true);
 });
 it.each([{title:'1234'}, {title:'x'.repeat(201)}, {title:'Valid topic',description:'x'.repeat(2001)}, {title:'Valid topic',durationSeconds:119}, {title:'Valid topic',durationSeconds:1801}])('rejects invalid field boundaries', value => {
  expect(createRoomSchema.safeParse(value).success).toBe(false);
 });
});
