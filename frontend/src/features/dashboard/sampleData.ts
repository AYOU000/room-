// SAMPLE DATA ONLY. Replace with real API calls when auth, rooms and history endpoints exist.
import type {
  CreateRoomInput,
  CreateRoomResult,
  DashboardStats,
  JoinRoomResult,
  RecentDebate,
} from "./types";

export const sampleUserName = "Amina";

export const sampleStats: DashboardStats = {
  totalDebates: 12,
  completedDebates: 9,
  averageScore: 74,
  minutesDebated: 128,
};

export const sampleRecentDebates: RecentDebate[] = [
  {
    sessionId: "s-1042",
    topic: "Remote work makes teams more productive",
    opponentName: "Youssef",
    startedAt: "2026-11-06T18:30:00Z",
    durationMinutes: 10,
    status: "completed",
    evaluation: "completed",
    scores: { you: 78, opponent: 71 },
  },
  {
    sessionId: "s-1039",
    topic: "Cities should ban private cars from their centres",
    opponentName: "Lina",
    startedAt: "2026-11-05T20:10:00Z",
    durationMinutes: 15,
    status: "completed",
    evaluation: "processing",
  },
  {
    sessionId: "s-1031",
    topic: "Social media does more harm than good for teenagers",
    opponentName: "Omar",
    startedAt: "2026-11-03T16:45:00Z",
    durationMinutes: 10,
    status: "interrupted",
    evaluation: "unavailable",
  },
  {
    sessionId: "s-1027",
    topic: "Universities should drop entrance exams",
    opponentName: "Sara",
    startedAt: "2026-11-01T11:00:00Z",
    durationMinutes: 20,
    status: "completed",
    evaluation: "completed",
    scores: { you: 69, opponent: 69 },
  },
  {
    sessionId: "s-1020",
    topic: "Nuclear power is essential for climate goals",
    opponentName: "Karim",
    startedAt: "2026-10-29T19:20:00Z",
    durationMinutes: 10,
    status: "cancelled",
    evaluation: "unavailable",
  },
];

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function sampleCreateRoom(_input: CreateRoomInput): Promise<CreateRoomResult> {
  await wait(600);
  return {
    inviteCode: "QX7M-4KD2-PL9A",
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  };
}

// Type EXPIRED or FULL to preview those error states.
export async function sampleJoinRoom(code: string): Promise<JoinRoomResult> {
  await wait(500);
  const normalized = code.trim().toUpperCase();
  if (normalized === "EXPIRED") return { ok: false, reason: "expired" };
  if (normalized === "FULL") return { ok: false, reason: "full" };
  if (normalized.length < 6) return { ok: false, reason: "invalid" };
  return { ok: true, roomId: "r-sample" };
}
