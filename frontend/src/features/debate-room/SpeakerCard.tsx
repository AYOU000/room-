import type { RoomParticipant } from "./types";

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join("");
}

function LevelBars({ active }: { active: boolean }) {
  return (
    <span aria-hidden="true" className="flex h-4 items-end gap-0.75">
      {[0, 180, 90, 270].map((delay) => (
        <span
          key={delay}
          style={{ animationDelay: `${delay}ms` }}
          className={`h-full w-0.75 origin-bottom rounded-full ${
            active ? "animate-level bg-olive" : "scale-y-25 bg-[#cfcfc4]"
          }`}
        />
      ))}
    </span>
  );
}

function statusText(participant: RoomParticipant, graceLabel?: string) {
  if (participant.connection === "disconnected") return graceLabel ? `Disconnected · ${graceLabel}` : "Disconnected";
  if (participant.connection === "reconnecting") return "Reconnecting…";
  if (participant.micMuted) return "Muted";
  if (participant.speaking) return "Speaking";
  return "Listening";
}

export function SpeakerCard({ participant, graceLabel }: { participant: RoomParticipant; graceLabel?: string }) {
  const offline = participant.connection !== "connected";
  const speaking = participant.speaking && !participant.micMuted && !offline;

  return (
    <article
      aria-label={`${participant.isYou ? "You" : "Opponent"}: ${participant.name}`}
      className={`relative flex min-w-0 flex-col items-center rounded-[10px] border px-4 pt-6 pb-5 text-center transition-colors sm:pt-8 ${
        speaking ? "border-olive-light bg-[#fbfdef]" : offline ? "border-dashed border-[#d6d4cb] bg-surface" : "border-[#e3e1d9] bg-card"
      }`}
    >
      <span className="absolute top-3 left-3 text-[8px] font-bold tracking-[0.8px] text-faint">
        {participant.isYou ? "YOU" : "OPPONENT"}
      </span>

      <div
        className={`grid size-16 place-items-center rounded-full font-display text-xl font-extrabold sm:size-20 sm:text-2xl ${
          participant.isYou ? "bg-[#e8ebdc] text-[#52642e]" : "bg-[#ecebe4] text-[#55574f]"
        } ${speaking ? "animate-pulse-ring" : ""} ${offline ? "opacity-45" : ""}`}
      >
        {initials(participant.name)}
      </div>

      <strong className="mt-3.5 max-w-full truncate text-sm font-bold">{participant.name}</strong>

      <span
        className={`mt-2 flex items-center gap-2 text-[11px] ${
          offline ? "font-bold text-caution" : participant.micMuted ? "font-bold text-danger" : "text-muted"
        }`}
      >
        {!offline && !participant.micMuted && <LevelBars active={speaking} />}
        {participant.micMuted && !offline && (
          <svg aria-hidden="true" viewBox="0 0 16 16" className="size-3.5 fill-none stroke-current stroke-[1.6]">
            <path d="M6 3.5a2 2 0 0 1 4 0V8M10 10.5A2 2 0 0 1 6 8V6.5M3.5 7.5a4.5 4.5 0 0 0 7.6 3.2M12.5 7.5c0 .5-.1 1-.2 1.4M8 12v2M2 2l12 12" />
          </svg>
        )}
        {statusText(participant, graceLabel)}
      </span>
    </article>
  );
}
