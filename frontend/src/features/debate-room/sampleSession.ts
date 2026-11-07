// SAMPLE DATA ONLY. Simulates a live session so the room UI can be designed
// without LiveKit, the event channel or ASR. Replace with real state later.
import { useCallback, useEffect, useRef, useState } from "react";
import type { MicDevice, RoomParticipant, TranscriptSegment } from "./types";

export const sampleTopic = "Remote work makes teams more productive";
export const sampleDurationMinutes = 10;

export const sampleDevices: MicDevice[] = [
  { id: "default", label: "MacBook Pro Microphone" },
  { id: "airpods", label: "AirPods Pro" },
  { id: "usb", label: "USB Audio Interface" },
];

export const sampleParticipants: RoomParticipant[] = [
  { id: "u-you", name: "Amina", isYou: true, connection: "connected", micMuted: false, speaking: false },
  { id: "u-opp", name: "Youssef", isYou: false, connection: "connected", micMuted: false, speaking: false },
];

type ScriptLine = { participantId: string | null; text: string; overlapping?: boolean };

const script: ScriptLine[] = [
  { participantId: "u-you", text: "I'll open with the evidence: several large studies found remote staff complete more tasks per day." },
  { participantId: "u-opp", text: "Tasks completed isn't the same as productivity. Collaboration and mentoring suffer when nobody shares a room." },
  { participantId: "u-you", text: "Collaboration tools have closed most of that gap, and people lose almost an hour a day commuting." },
  { participantId: "u-opp", text: "Then why are so many companies asking people to come back to the office?" },
  { participantId: null, text: "— but that's a management preference —", overlapping: true },
  { participantId: "u-you", text: "Many of those decisions are about real estate and control, not measured output." },
  { participantId: "u-opp", text: "Junior employees learn by watching others work. That's very hard to replicate on video calls." },
  { participantId: "u-you", text: "That's fair, and it's an argument for deliberate mentoring time, not for five office days a week." },
];

const LINE_EVERY_MS = 3800;
const FINALIZE_AFTER_MS = 1600;

// Emits provisional segments that later finalize (FR-14 revisions), and tracks who is speaking.
export function useSampleTranscript(running: boolean) {
  const [segments, setSegments] = useState<TranscriptSegment[]>([]);
  const [speakerId, setSpeakerId] = useState<string | null>(null);
  const index = useRef(0);

  useEffect(() => {
    if (!running) {
      setSpeakerId(null);
      return;
    }

    const timers: ReturnType<typeof setTimeout>[] = [];

    function emit() {
      const i = index.current;
      if (i >= script.length) {
        setSpeakerId(null);
        return;
      }
      index.current += 1;
      const line = script[i];
      const segmentId = `seg-${i}`;
      const startMs = i * LINE_EVERY_MS;
      const words = line.text.split(" ");
      const partial = words.slice(0, Math.max(3, Math.ceil(words.length / 2))).join(" ");

      setSpeakerId(line.participantId);
      setSegments((current) => [
        ...current,
        {
          segmentId,
          revision: 1,
          participantId: line.participantId,
          startMs,
          endMs: startMs + FINALIZE_AFTER_MS,
          text: partial,
          isFinal: false,
          overlapping: line.overlapping,
        },
      ]);

      timers.push(
        setTimeout(() => {
          setSegments((current) =>
            current.map((segment) =>
              segment.segmentId === segmentId
                ? { ...segment, revision: 2, text: line.text, isFinal: true, endMs: startMs + LINE_EVERY_MS - 400 }
                : segment,
            ),
          );
          setSpeakerId(null);
        }, FINALIZE_AFTER_MS),
      );
      timers.push(setTimeout(emit, LINE_EVERY_MS));
    }

    timers.push(setTimeout(emit, 600));
    return () => timers.forEach(clearTimeout);
  }, [running]);

  const clear = useCallback(() => {
    index.current = 0;
    setSegments([]);
    setSpeakerId(null);
  }, []);

  return { segments, speakerId, clear };
}
