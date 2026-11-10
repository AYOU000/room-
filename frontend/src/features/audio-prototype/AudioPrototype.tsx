// Temporary audio check carried over from the first prototype.
// The client picks its own identity here; FR-09 requires the server to bind
// LiveKit identity to the account, so the session room (POST /sessions/:id/media-token)
// replaces this once Members 1 and 2 ship auth and rooms.
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { Room, RoomEvent, Track } from "livekit-client";
import { Kicker } from "../../components/Kicker";
import { StatusDot } from "../../components/StatusDot";
import { apiStatusTone, useApiHealth, type ApiStatus } from "../../lib/api-health";
import { API_URL } from "../../lib/config";

type TokenResponse = {
  serverUrl: string;
  roomName: string;
  identity: string;
  token: string;
  error?: string;
};

const healthMessage: Record<ApiStatus, string> = {
  idle: "Waiting for connection status.",
  checking: "Checking the Room API...",
  online: "Your Room API is responding.",
  offline: "Cannot reach the API. Check Docker and your network.",
};

const inputClass =
  "h-11.25 w-full min-w-0 rounded-[5px] border border-[#e1dfd6] bg-card px-3 text-xs font-normal text-ink outline-none transition-colors placeholder:text-[#a1a198] focus:border-[#8b9b50] focus:outline-3 focus:outline-[rgb(139_155_80/12%)] disabled:bg-[#f2f1eb] disabled:text-[#73746d]";

function ParticipantCard({
  active,
  avatar,
  role,
  name,
  state,
}: {
  active: boolean;
  avatar: ReactNode;
  role: string;
  name: string;
  state: string;
}) {
  return (
    <div
      className={`flex min-w-0 items-center gap-3 rounded-[7px] border p-3 transition-colors sm:px-3 sm:py-3.75 ${
        active ? "border-olive-light bg-[#fbfdef]" : "border-[#e8e6df] bg-surface"
      }`}
    >
      {avatar}
      <div className="grid min-w-0 gap-1.25">
        <span className="text-[8px] font-bold tracking-[0.8px] text-faint">{role}</span>
        <strong className="truncate text-xs font-bold">{name}</strong>
        <span className="flex items-center gap-1.75 text-[10px] text-[#85867d]">
          <StatusDot tone={active ? "live" : "idle"} />
          {state}
        </span>
      </div>
    </div>
  );
}

function GuideCard() {
  const { status, recheck } = useApiHealth();
  const steps = [
    "Choose a room name and share it with your opponent.",
    "Allow microphone access when your browser asks.",
    "Both participants must join the same room name.",
  ];

  return (
    <aside className="flex flex-col rounded-[9px] bg-sand p-5.5 sm:grid sm:grid-cols-2 sm:gap-x-6.25 sm:px-5.75 sm:pt-6.75 tab:flex">
      <Kicker className="text-[9px] sm:col-span-full">BEFORE YOU BEGIN</Kicker>
      <h3 className="mt-4 mb-3.75 max-w-100 font-display text-[23px] leading-[1.35] font-bold tracking-[-1px] sm:col-span-full sm:mt-5 tab:mb-6 tab:max-w-57.5">
        A good debate starts with showing up.
      </h3>

      <ol className="contents">
        {steps.map((step, index) => (
          <li key={step} className="grid grid-cols-[28px_1fr] gap-2.5 self-start border-t border-line-strong py-3.75">
            <span className="pt-0.5 text-[10px] font-bold text-[#788343]">{String(index + 1).padStart(2, "0")}</span>
            <p className="text-[11px] leading-[1.8] text-[#67695f]">{step}</p>
          </li>
        ))}
      </ol>

      <div className="mt-4.25 rounded-md border border-line-strong bg-[rgb(255_255_250/65%)] p-4 sm:col-span-full sm:mt-3.75 tab:mt-auto">
        <div className="flex items-center gap-2.25">
          <StatusDot tone={apiStatusTone[status]} />
          <strong className="text-[11px]">Backend connection</strong>
        </div>
        <p className="mt-2.5 mb-3 text-[10px] leading-[1.7] text-muted">{healthMessage[status]}</p>
        <button
          type="button"
          onClick={() => void recheck()}
          disabled={status === "checking"}
          className="inline-flex items-center gap-2 text-[11px] font-bold text-olive-dark enabled:hover:underline disabled:cursor-wait disabled:opacity-65"
        >
          Check again <span aria-hidden="true">↗</span>
        </button>
      </div>
    </aside>
  );
}

export function AudioPrototype() {
  const [roomName, setRoomName] = useState("room-test");
  const [identity, setIdentity] = useState(() => `participant-${Math.random().toString(36).slice(2, 7)}`);
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [micEnabled, setMicEnabled] = useState(false);
  const [participantCount, setParticipantCount] = useState(0);
  const [error, setError] = useState("");

  const roomRef = useRef<Room | null>(null);
  const remoteAudioRef = useRef<HTMLDivElement | null>(null);

  async function joinCall(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (connecting || connected) return;

    setError("");
    setConnecting(true);

    let room: Room | null = null;

    try {
      const response = await fetch(`${API_URL}/api/rooms/token`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roomName: roomName.trim(), identity: identity.trim() }),
      });

      const data = (await response.json()) as TokenResponse;
      if (!response.ok) throw new Error(data.error || "Could not get a room access token.");

      const activeRoom = new Room();
      room = activeRoom;
      roomRef.current = activeRoom;

      const syncCount = () => setParticipantCount(1 + activeRoom.remoteParticipants.size);
      activeRoom.on(RoomEvent.ParticipantConnected, syncCount);
      activeRoom.on(RoomEvent.ParticipantDisconnected, syncCount);

      activeRoom.on(RoomEvent.TrackSubscribed, (track) => {
        if (track.kind === Track.Kind.Audio && remoteAudioRef.current) {
          const audio = track.attach();
          audio.autoplay = true;
          remoteAudioRef.current.appendChild(audio);
        }
      });

      activeRoom.on(RoomEvent.TrackUnsubscribed, (track) => {
        track.detach().forEach((element) => element.remove());
      });

      activeRoom.on(RoomEvent.Disconnected, () => {
        setConnected(false);
        setMicEnabled(false);
        setParticipantCount(0);
      });

      await activeRoom.connect(data.serverUrl, data.token);
      await activeRoom.localParticipant.setMicrophoneEnabled(true);

      setConnected(true);
      setMicEnabled(true);
      syncCount();
    } catch (err) {
      if (room) {
        await room.disconnect().catch(() => {});
        if (roomRef.current === room) roomRef.current = null;
      }

      setConnected(false);
      setMicEnabled(false);
      setParticipantCount(0);
      setError(err instanceof Error ? err.message : "Could not join the call.");
    } finally {
      setConnecting(false);
    }
  }

  async function toggleMicrophone() {
    const room = roomRef.current;
    if (!room || !connected) return;

    try {
      const nextEnabled = !micEnabled;
      await room.localParticipant.setMicrophoneEnabled(nextEnabled);
      setMicEnabled(nextEnabled);
      setError("");
    } catch {
      setError("Could not change microphone state. Check browser permissions.");
    }
  }

  function leaveCall() {
    const room = roomRef.current;
    roomRef.current = null;

    if (room) {
      room.removeAllListeners();
      void room.disconnect();
    }

    remoteAudioRef.current?.replaceChildren();
    setConnected(false);
    setMicEnabled(false);
    setParticipantCount(0);
    setError("");
  }

  useEffect(() => {
    return () => {
      roomRef.current?.disconnect();
      roomRef.current = null;
    };
  }, []);

  const opponentPresent = participantCount > 1;

  return (
    <section id="debate" aria-labelledby="debate-heading" className="border-t border-line pt-10.5 pb-13.75 sm:pt-13.5 sm:pb-21.25">
      <div className="mb-5.75 flex flex-col items-start gap-3 sm:mb-7.5 sm:flex-row sm:items-end sm:justify-between sm:gap-7.5">
        <div>
          <Kicker className="mb-3">YOUR NEXT CONVERSATION</Kicker>
          <h2 id="debate-heading" className="font-display text-[clamp(30px,4vw,42px)] font-bold tracking-[-2px]">
            Enter the room<span className="text-olive">.</span>
          </h2>
        </div>
        <p className="mb-1.25 max-w-full text-xs leading-[1.8] text-muted sm:max-w-67.5">
          Open the same room on two devices to start talking.
        </p>
      </div>

      <div className="grid items-stretch gap-5 tab:grid-cols-[minmax(0,1.6fr)_minmax(250px,0.75fr)]">
        <div className="min-w-0 rounded-[10px] border border-[#e3e1d9] bg-card p-4.75 sm:p-7.5">
          <div className="flex items-start justify-between gap-3.75">
            <div>
              <span className="flex items-center gap-2 text-[9px] font-bold tracking-[1.2px] text-[#72746a]">
                <StatusDot tone={connected ? "live" : "idle"} />
                {connected ? "SESSION LIVE" : "AUDIO SESSION"}
              </span>
              <h3 className="mt-3.25 font-display text-[21px] font-bold tracking-[-1px] sm:text-2xl">
                {connected ? "You're in the room." : "Take your seat."}
              </h3>
            </div>
            <span className="rounded border border-line p-1.75 text-[8px] font-bold whitespace-nowrap text-[#797a72] sm:px-2.5 sm:py-2 sm:text-[9px]">
              ROOM / 01
            </span>
          </div>

          <div className="mt-5 mb-5.75 grid gap-2.25 sm:mt-6.25 sm:mb-7 sm:grid-cols-2 sm:gap-3">
            <ParticipantCard
              active={connected}
              avatar={
                <div className="grid size-10.5 shrink-0 place-items-center rounded-[7px] bg-[#e8ebdc] text-[10px] font-extrabold text-[#52642e]">
                  YOU
                </div>
              }
              role="PARTICIPANT 01"
              name={identity.trim() || "Your name"}
              state={connected ? (micEnabled ? "Microphone on" : "Microphone muted") : "Not connected"}
            />
            <ParticipantCard
              active={opponentPresent}
              avatar={
                <div
                  aria-hidden="true"
                  className="grid size-10.5 shrink-0 place-items-center rounded-[7px] border border-dashed border-[#c9c9bd] bg-[#f4f2eb] text-[22px] text-[#7b7d72]"
                >
                  +
                </div>
              }
              role="PARTICIPANT 02"
              name={opponentPresent ? "Opponent connected" : "Your opponent"}
              state={opponentPresent ? "In the room" : "Waiting to join"}
            />
          </div>

          <form className="grid gap-4.5" onSubmit={joinCall}>
            <div className="grid gap-3.5 sm:grid-cols-2 sm:gap-3.25">
              <label className="grid gap-2 text-[11px] font-bold text-[#55574f]">
                Room name
                <input
                  className={inputClass}
                  value={roomName}
                  onChange={(event) => setRoomName(event.target.value)}
                  placeholder="room-test"
                  required
                  disabled={connected || connecting}
                  maxLength={64}
                />
              </label>

              <label className="grid gap-2 text-[11px] font-bold text-[#55574f]">
                Your display name
                <input
                  className={inputClass}
                  value={identity}
                  onChange={(event) => setIdentity(event.target.value)}
                  placeholder="Your name"
                  required
                  disabled={connected || connecting}
                  maxLength={64}
                />
              </label>
            </div>

            {!connected ? (
              <button
                type="submit"
                disabled={connecting}
                className="flex min-h-12.25 w-full items-center justify-between rounded-[5px] bg-ink px-4 text-xs font-bold text-white transition-colors enabled:hover:bg-ink-hover disabled:cursor-wait disabled:opacity-65"
              >
                <span>{connecting ? "Connecting to room..." : "Join audio room"}</span>
                <span aria-hidden="true" className="grid size-6.75 place-items-center rounded bg-accent text-[15px] text-ink">
                  {connecting ? "···" : "↗"}
                </span>
              </button>
            ) : (
              <div className="flex gap-2.5">
                <button
                  type="button"
                  onClick={toggleMicrophone}
                  className="min-h-11.5 flex-1 rounded-[5px] border border-[#d9ddc8] bg-accent px-3.5 py-2.5 text-xs font-bold text-ink hover:bg-accent-hover"
                >
                  {micEnabled ? "Mute microphone" : "Unmute microphone"}
                </button>
                <button
                  type="button"
                  onClick={leaveCall}
                  className="min-h-11.5 flex-1 rounded-[5px] border border-[#ead4cf] bg-danger-bg px-3.5 py-2.5 text-xs font-bold text-danger hover:bg-[#fbe8e3]"
                >
                  Leave room <span aria-hidden="true">×</span>
                </button>
              </div>
            )}
          </form>

          <div className="mt-5.25 flex flex-col items-start justify-between gap-3 border-t border-line pt-4 text-[9px] text-[#83847b] sm:flex-row sm:items-center">
            <span className="flex items-center gap-2" role="status">
              <StatusDot tone={connected ? "live" : "idle"} />
              {connecting
                ? "Establishing connection"
                : connected
                  ? `${participantCount} participant${participantCount === 1 ? "" : "s"} connected`
                  : "Microphone access required"}
            </span>
            <span className="font-bold tracking-[0.8px]">LIVEKIT AUDIO</span>
          </div>

          {error && (
            <p
              role="alert"
              className="mt-3.75 rounded-[5px] border border-danger-line bg-[#fff4f1] px-3 py-2.75 text-xs leading-[1.6] wrap-anywhere text-danger"
            >
              {error}
            </p>
          )}
          <div ref={remoteAudioRef} />
        </div>

        <GuideCard />
      </div>
    </section>
  );
}
