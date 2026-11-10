import { formatClock } from "./useCountdown";

// Only announce milestones to screen readers, not every tick.
function milestone(ms: number) {
  if (ms <= 0) return "Time is up.";
  if (ms <= 10_000) return "10 seconds left.";
  if (ms <= 60_000) return "1 minute left.";
  return "";
}

export function DebateTimer({ remainingMs, totalMs }: { remainingMs: number; totalMs: number }) {
  const progress = totalMs > 0 ? Math.min(1, Math.max(0, 1 - remainingMs / totalMs)) : 1;
  const lastMinute = remainingMs <= 60_000;

  return (
    <div className="grid min-w-36 gap-2">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-[9px] font-bold tracking-[1.2px] text-faint">TIME LEFT</span>
        {lastMinute && remainingMs > 0 && (
          <span className="text-[10px] font-bold text-danger">Final minute</span>
        )}
      </div>
      <span
        role="timer"
        aria-label={`Time left ${formatClock(remainingMs)}`}
        className={`text-[40px] leading-none font-semibold tracking-[-1.5px] tabular-nums sm:text-[48px] ${
          lastMinute ? "text-danger" : "text-ink"
        }`}
      >
        {formatClock(remainingMs)}
      </span>
      <div
        role="progressbar"
        aria-label="Debate progress"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(progress * 100)}
        className="h-1 overflow-hidden rounded-full bg-[#e8ebdc]"
      >
        <div
          className={`h-full rounded-full transition-[width] duration-300 ${lastMinute ? "bg-danger" : "bg-olive"}`}
          style={{ width: `${progress * 100}%` }}
        />
      </div>
      <p role="status" className="sr-only">
        {milestone(remainingMs)}
      </p>
    </div>
  );
}
