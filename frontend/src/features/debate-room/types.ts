// View models for the live debate room. Backend owners map LiveKit state and
// /events messages onto these shapes when they replace ./sampleSession.

export type ConnectionState = "connected" | "reconnecting" | "disconnected";

export type RoomParticipant = {
  id: string;
  name: string;
  isYou: boolean;
  connection: ConnectionState;
  micMuted: boolean;
  speaking: boolean;
};

// Mirrors the FR-14 segment format, minus session_id.
export type TranscriptSegment = {
  segmentId: string;
  revision: number;
  participantId: string | null; // null = speaker could not be attributed (FR-15)
  startMs: number; // relative to session start
  endMs: number;
  text: string;
  isFinal: boolean;
  overlapping?: boolean;
};

export type EndReason = "timer" | "user_end" | "disconnect" | "service_failure";

export type MicDevice = { id: string; label: string };

// UI preview states. Each maps to a situation the real room must handle.
export type RoomScenario =
  | "live"
  | "opponent-disconnected"
  | "you-reconnecting"
  | "transcription-degraded"
  | "mic-blocked"
  | "ended";
