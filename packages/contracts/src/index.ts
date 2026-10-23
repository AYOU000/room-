import { z } from 'zod';

// Infrastructure handoff contracts, pending confirmation against the missing audio SRS v3.
export const contractVersion = 1 as const;
export const audioTrackSchema = z.object({
  roomId: z.uuid(), roundId: z.uuid(), participantId: z.uuid(),
  recordingId: z.uuid(), trackId: z.uuid(), consentId: z.uuid(),
  phase: z.enum(['SOLO', 'OPEN']),
  mimeType: z.enum(['audio/webm', 'audio/ogg', 'audio/mp4', 'audio/wav']),
}).strict();
export type AudioTrack = z.infer<typeof audioTrackSchema>;

export const audioSegmentSchema = z.object({
  sequence: z.number().int().nonnegative(),
  startMs: z.number().int().nonnegative(), endMs: z.number().int().positive(),
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
  bytes: z.number().int().positive(),
}).strict().refine(s => s.endMs > s.startMs, 'Segment must have positive duration');
export type AudioSegment = z.infer<typeof audioSegmentSchema>;

// Only trusted media adapters may populate canonical timestamps and track identity.
// Fails closed on missing/overlapping chunks; no guessed transcription across gaps.
export function validateManifest(segments: AudioSegment[], cutoffMs: number): AudioSegment[] {
  if (!Number.isSafeInteger(cutoffMs) || cutoffMs <= 0) throw new Error('Invalid cutoff');
  if (!segments.length) throw new Error('Empty recording');
  let end = 0;
  return segments.map((input, sequence) => {
    const segment = audioSegmentSchema.parse(input);
    if (segment.sequence !== sequence || segment.startMs !== end) throw new Error('Recording gap or overlap');
    if (segment.endMs > cutoffMs) throw new Error('Segment crosses authoritative cutoff');
    end = segment.endMs;
    return segment;
  });
}

export const maintenancePayloadSchema = z.object({}).strict();
export const jobTypes = ['storage.delete', 'storage.retention', 'storage.orphans'] as const;
export type JobType = typeof jobTypes[number];
export const deletionPayloadSchema = z.object({ tombstoneId: z.uuid() }).strict();
export interface HealthResponse { status: 'ok' | 'unavailable' | 'draining'; service: 'api' | 'worker' }

export const orphanScanPayloadSchema = z.object({ cursor:z.string().optional() }).strict();
