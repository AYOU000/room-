import { z } from 'zod';
import { uuidSchema } from './security-validation.js';

export const sessionStateSchema = z.enum(['waiting', 'active', 'finishing', 'ended', 'cancelled']);
export const evaluationStatusSchema = z.enum(['pending', 'processing', 'completed', 'failed', 'unavailable']);
export const endReasonSchema = z.enum(['timer', 'user_end', 'disconnect', 'service_failure']);
const timestamp = z.union([z.date(), z.iso.datetime()]);
export const roomSnapshotSchema = z.strictObject({
  room: z.strictObject({ id: uuidSchema, status: z.enum(['waiting', 'active', 'closed', 'cancelled']), creatorId: uuidSchema, title: z.string(), description: z.string().nullable(), durationSeconds: z.number().int().min(120).max(1800) }),
  session: z.strictObject({ id: uuidSchema, state: sessionStateSchema, evaluationStatus: evaluationStatusSchema, startedAt: timestamp.nullable(), endsAt: timestamp.nullable(), endedAt: timestamp.nullable(), endReason: endReasonSchema.nullable(), serverTime: timestamp }),
  participants: z.array(z.strictObject({ participantId: uuidSchema, slot: z.union([z.literal(1), z.literal(2)]), ready: z.boolean(), consentVersion: z.string().nullable(), connection: z.enum(['connected', 'disconnected']) })).max(2),
});
export const sessionEventSchema = z.strictObject({
  event_id: uuidSchema, session_id: uuidSchema, type: z.literal('session.state'),
  sequence: z.number().int().positive(), server_time: z.iso.datetime(), payload: roomSnapshotSchema,
}).refine(event => event.session_id === event.payload.session.id, 'Event session must match payload');
export type SessionEvent = z.infer<typeof sessionEventSchema>;
