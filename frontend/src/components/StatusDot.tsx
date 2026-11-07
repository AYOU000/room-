export type StatusTone = "idle" | "live" | "checking" | "offline";

const toneClass: Record<StatusTone, string> = {
  idle: "bg-[#b8b9b0]",
  live: "bg-live shadow-[0_0_0_3px_rgb(75_155_85/12%)]",
  checking: "bg-warn",
  offline: "bg-offline",
};

// Decorative only: always pair with a text label so status is not color-only (NFR-05).
export function StatusDot({ tone = "idle" }: { tone?: StatusTone }) {
  return <span aria-hidden="true" className={`size-1.75 shrink-0 rounded-full ${toneClass[tone]}`} />;
}
