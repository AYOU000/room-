import { useEffect, useState } from "react";
import { useParams } from "react-router";
import { Kicker } from "../components/Kicker";
import { StatusDot } from "../components/StatusDot";
import { DebateEnded } from "../features/debate-room/DebateEnded";
import { DebateTimer } from "../features/debate-room/DebateTimer";
import { EndDebateDialog } from "../features/debate-room/EndDebateDialog";
import { MicControls } from "../features/debate-room/MicControls";
import { RoomBanner } from "../features/debate-room/RoomBanner";
import {
  sampleDevices,
  sampleDurationMinutes,
  sampleParticipants,
  sampleTopic,
  useSampleTranscript,
} from "../features/debate-room/sampleSession";
import { ScenarioSwitcher } from "../features/debate-room/ScenarioSwitcher";
import { SpeakerCard } from "../features/debate-room/SpeakerCard";
import { TranscriptPanel } from "../features/debate-room/TranscriptPanel";
import type { EndReason, RoomParticipant, RoomScenario } from "../features/debate-room/types";
import { formatClock, useCountdown } from "../features/debate-room/useCountdown";

const TOTAL_MS = sampleDurationMinutes * 60_000;
const GRACE_MS = 60_000;

export function DebateRoomPage() {
  const { sessionId = "sample" } = useParams();
  const [scenario, setScenario] = useState<RoomScenario>("live");
  const [endsAt, setEndsAt] = useState(() => Date.now() + TOTAL_MS);
  const [graceEndsAt, setGraceEndsAt] = useState<number | null>(null);
  const [endReason, setEndReason] = useState<EndReason | null>(null);
  const [muted, setMuted] = useState(false);
  const [deviceId, setDeviceId] = useState(sampleDevices[0]!.id);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const ended = scenario === "ended" ? "user_end" : endReason;
  const remainingMs = useCountdown(ended ? null : endsAt);
  const graceMs = useCountdown(ended ? null : graceEndsAt);
  const transcript = useSampleTranscript(!ended && scenario !== "you-reconnecting");

  // Timer expiry and disconnect grace both end the session (FR-11, FR-12).
  useEffect(() => {
    if (ended) return;
    if (remainingMs === 0) setEndReason("timer");
    else if (graceEndsAt !== null && graceMs === 0) setEndReason("disconnect");
  }, [ended, remainingMs, graceEndsAt, graceMs]);

  // FR-17: drop transcript UI state as soon as the session ends.
  const { clear } = transcript;
  useEffect(() => {
    if (ended) {
      clear();
      setConfirmOpen(false);
    }
  }, [ended, clear]);

  function changeScenario(next: RoomScenario) {
    setScenario(next);
    setGraceEndsAt(next === "opponent-disconnected" ? Date.now() + GRACE_MS : null);
    if (next !== "ended") {
      setEndReason(null);
      if (remainingMs === 0) setEndsAt(Date.now() + TOTAL_MS);
    }
  }

  const micBlocked = scenario === "mic-blocked";
  const participants: RoomParticipant[] = sampleParticipants.map((participant) => {
    const connection =
      participant.isYou && scenario === "you-reconnecting"
        ? "reconnecting"
        : !participant.isYou && scenario === "opponent-disconnected"
          ? "disconnected"
          : "connected";
    return {
      ...participant,
      connection,
      micMuted: participant.isYou ? muted || micBlocked : participant.micMuted,
      speaking: transcript.speakerId === participant.id && connection === "connected",
    };
  });
  const [you, opponent] = participants as [RoomParticipant, RoomParticipant];

  if (ended) {
    return (
      <div className="grid gap-4 pt-8">
        <ScenarioSwitcher value={scenario} onChange={changeScenario} />
        <DebateEnded reason={ended} topic={sampleTopic} />
      </div>
    );
  }

  return (
    <div className="grid gap-4 pt-8 pb-14 sm:pt-10 sm:pb-20">
      <ScenarioSwitcher value={scenario} onChange={changeScenario} />

      <header className="flex flex-col gap-6 rounded-[10px] border border-[#e3e1d9] bg-card p-5 sm:flex-row sm:items-end sm:justify-between sm:p-7.5">
        <div className="min-w-0">
          <Kicker className="gap-2 text-[9px]">
            <StatusDot tone={scenario === "you-reconnecting" ? "checking" : "live"} />
            {scenario === "you-reconnecting" ? "RECONNECTING" : "LIVE DEBATE"}
            <span aria-hidden="true">·</span>
            <span>ROOM / {sessionId.toUpperCase()}</span>
          </Kicker>
          <h1 className="mt-3 font-display text-[clamp(22px,3vw,32px)] leading-tight font-bold tracking-[-1px] wrap-break-word">
            {sampleTopic}
          </h1>
          <p className="mt-2 text-[11px] text-muted">
            {sampleDurationMinutes} min · Audio only · Both microphones open
          </p>
        </div>
        <DebateTimer remainingMs={remainingMs} totalMs={TOTAL_MS} />
      </header>

      {scenario === "opponent-disconnected" && (
        <RoomBanner tone="caution" title={`${opponent.name} lost connection.`}>
          The timer keeps running. If they're not back in {formatClock(graceMs)}, the debate ends as interrupted.
        </RoomBanner>
      )}
      {scenario === "you-reconnecting" && (
        <RoomBanner tone="caution" title="Reconnecting…">
          Your connection dropped. Room is trying to rejoin you; the timer keeps running and nothing you said is lost.
        </RoomBanner>
      )}

      <div className="grid items-start gap-4 tab:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
        <div className="grid gap-4">
          <div className="grid grid-cols-2 gap-3">
            <SpeakerCard participant={you} />
            <SpeakerCard
              participant={opponent}
              graceLabel={scenario === "opponent-disconnected" ? `${formatClock(graceMs)} left` : undefined}
            />
          </div>
          <MicControls
            muted={muted}
            blocked={micBlocked}
            disabled={scenario === "you-reconnecting"}
            devices={sampleDevices}
            deviceId={deviceId}
            onToggleMute={() => setMuted((value) => !value)}
            onDeviceChange={setDeviceId}
            onRetryPermission={() => changeScenario("live")}
            onEnd={() => setConfirmOpen(true)}
          />
        </div>

        <TranscriptPanel
          segments={transcript.segments}
          participants={participants}
          degraded={scenario === "transcription-degraded"}
        />
      </div>

      <EndDebateDialog
        open={confirmOpen}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={() => setEndReason("user_end")}
      />
    </div>
  );
}
