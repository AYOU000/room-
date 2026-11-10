import { useEffect, useState } from "react";

// Remaining time until `endsAt` (epoch ms). The browser never owns the clock:
// `serverOffsetMs` = server_time - Date.now(), measured from server events (FR-10),
// so changing the local clock or reloading cannot extend the debate.
export function useCountdown(endsAt: number | null, serverOffsetMs = 0): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (endsAt === null) return;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [endsAt]);

  if (endsAt === null) return 0;
  return Math.max(0, endsAt - (now + serverOffsetMs));
}

export function formatClock(ms: number): string {
  const totalSeconds = Math.ceil(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}
