import { useEffect, useRef, useState } from "react";
import { formatClock } from "./useCountdown";
import type { RoomParticipant, TranscriptSegment } from "./types";

type TranscriptPanelProps = {
  segments: TranscriptSegment[];
  participants: RoomParticipant[];
  degraded: boolean;
};

const NEAR_BOTTOM_PX = 48;

function SegmentRow({ segment, speaker }: { segment: TranscriptSegment; speaker?: RoomParticipant }) {
  const name = speaker ? (speaker.isYou ? `${speaker.name} (you)` : speaker.name) : "Unknown speaker";
  const accent = !speaker ? "border-[#d6d4cb]" : speaker.isYou ? "border-olive" : "border-[#b9b8ad]";

  return (
    <li className={`border-l-2 py-1 pl-3.5 ${accent}`}>
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <span className="text-[11px] font-bold">{name}</span>
        <span className="text-[10px] text-faint tabular-nums">{formatClock(segment.startMs)}</span>
        {segment.overlapping && (
          <span className="rounded border border-caution-line bg-caution-bg px-1.5 py-0.5 text-[9px] font-bold text-caution">
            Overlapping speech
          </span>
        )}
        {!segment.isFinal && <span className="text-[9px] font-bold tracking-[0.6px] text-olive">LIVE</span>}
      </div>
      {/* Plain text only: ASR output is untrusted (SEC-02). */}
      <p
        className={`mt-1 text-[13px] leading-[1.65] wrap-break-word ${
          segment.isFinal ? "text-ink" : "text-muted italic"
        }`}
      >
        {segment.text}
        {!segment.isFinal && "…"}
      </p>
    </li>
  );
}

export function TranscriptPanel({ segments, participants, degraded }: TranscriptPanelProps) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [pinned, setPinned] = useState(true);
  const byId = new Map(participants.map((participant) => [participant.id, participant]));

  useEffect(() => {
    const element = scrollRef.current;
    if (element && pinned) element.scrollTop = element.scrollHeight;
  }, [segments, pinned]);

  function onScroll() {
    const element = scrollRef.current;
    if (!element) return;
    setPinned(element.scrollHeight - element.scrollTop - element.clientHeight < NEAR_BOTTOM_PX);
  }

  function jumpToLatest() {
    const element = scrollRef.current;
    if (element) element.scrollTop = element.scrollHeight;
    setPinned(true);
  }

  return (
    <section
      aria-labelledby="transcript-heading"
      className="relative flex min-h-0 min-w-0 flex-col rounded-[10px] border border-[#e3e1d9] bg-card"
    >
      <header className="flex items-start justify-between gap-3 border-b border-line px-5 pt-4.5 pb-3.5">
        <div>
          <h2 id="transcript-heading" className="font-display text-lg font-bold tracking-[-0.5px]">
            Live transcript
          </h2>
          <p className="mt-1 text-[10px] leading-normal text-muted">
            Temporary. Deleted from this browser when the debate ends.
          </p>
        </div>
        <span className="mt-1 flex items-center gap-1.5 text-[9px] font-bold tracking-[1px] text-faint">
          <span aria-hidden="true" className={`size-1.5 rounded-full ${degraded ? "bg-warn" : "bg-live"}`} />
          {degraded ? "DEGRADED" : "LISTENING"}
        </span>
      </header>

      {degraded && (
        <p role="alert" className="mx-5 mt-4 rounded-[5px] border border-caution-line bg-caution-bg px-3 py-2.5 text-[11px] leading-normal text-caution">
          Transcription is having trouble. Your audio still reaches your opponent, but some speech may be missing, so
          the AI evaluation may be unavailable for this debate.
        </p>
      )}

      <div
        ref={scrollRef}
        onScroll={onScroll}
        tabIndex={0}
        aria-label="Transcript"
        className="min-h-60 flex-1 overflow-y-auto px-5 py-4 tab:max-h-[min(560px,60vh)]"
      >
        {segments.length === 0 ? (
          <p className="py-10 text-center text-xs text-muted">Text appears here as you speak.</p>
        ) : (
          <ol aria-live="polite" aria-relevant="additions" className="grid gap-3.5">
            {segments.map((segment) => (
              <SegmentRow
                key={segment.segmentId}
                segment={segment}
                speaker={segment.participantId ? byId.get(segment.participantId) : undefined}
              />
            ))}
          </ol>
        )}
      </div>

      {!pinned && (
        <button
          type="button"
          onClick={jumpToLatest}
          className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-ink px-3.5 py-2 text-[11px] font-bold text-white shadow-lg"
        >
          New text below <span aria-hidden="true">↓</span>
        </button>
      )}
    </section>
  );
}
