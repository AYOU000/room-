// View models for the dashboard UI. The backend owners map their API responses
// onto these shapes when they wire real data in place of ./sampleData.

export type SessionStatus = "completed" | "cancelled" | "interrupted";

export type EvaluationStatus = "pending" | "processing" | "completed" | "failed" | "unavailable";

export type RecentDebate = {
  sessionId: string;
  topic: string;
  opponentName: string;
  startedAt: string; // ISO 8601
  durationMinutes: number;
  status: SessionStatus;
  evaluation: EvaluationStatus;
  // Totals out of 100, present only when evaluation is "completed".
  scores?: { you: number; opponent: number };
};

export type DashboardStats = {
  totalDebates: number;
  completedDebates: number;
  averageScore: number | null; // out of 100; null when no evaluated debates
  minutesDebated: number;
};

export type CreateRoomInput = {
  topic: string;
  description: string;
  durationMinutes: number;
};

export type CreateRoomResult = { inviteCode: string; expiresAt: string };

export type JoinRoomResult =
  | { ok: true; roomId: string }
  | { ok: false; reason: "invalid" | "expired" | "full" };
