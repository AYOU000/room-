
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Room, RoomEvent, Track } from "livekit-client";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";

type TokenResponse = {
  serverUrl: string;
  roomName: string;
  identity: string;
  token: string;
  error?: string;
};

export default function App() {
  const [apiStatus, setApiStatus] = useState<"idle" | "checking" | "online" | "offline">("idle");
  const [roomName, setRoomName] = useState("room-test");
  const [identity, setIdentity] = useState(
    () => `participant-${Math.random().toString(36).slice(2, 7)}`,
  );
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [micEnabled, setMicEnabled] = useState(false);
  const [participantCount, setParticipantCount] = useState(0);
  const [error, setError] = useState("");

  const roomRef = useRef<Room | null>(null);
  const remoteAudioRef = useRef<HTMLDivElement | null>(null);

  async function checkBackend() {
    setApiStatus("checking");

    try {
      const response = await fetch(`${API_URL}/health`);
      if (!response.ok) throw new Error("API request failed");

      const data = await response.json();
      setApiStatus(data.status === "ok" ? "online" : "offline");
    } catch {
      setApiStatus("offline");
    }
  }

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
        body: JSON.stringify({
          roomName: roomName.trim(),
          identity: identity.trim(),
        }),
      });

      const data = (await response.json()) as TokenResponse;

      if (!response.ok) {
        throw new Error(data.error || "Could not get a room access token.");
      }

      room = new Room();
      roomRef.current = room;

      room.on(RoomEvent.ParticipantConnected, () => {
        setParticipantCount(1 + room!.remoteParticipants.size);
      });

      room.on(RoomEvent.ParticipantDisconnected, () => {
        setParticipantCount(1 + room!.remoteParticipants.size);
      });

      room.on(RoomEvent.TrackSubscribed, (track) => {
        if (track.kind === Track.Kind.Audio && remoteAudioRef.current) {
          const audio = track.attach();
          audio.autoplay = true;
          remoteAudioRef.current.appendChild(audio);
        }
      });

      room.on(RoomEvent.TrackUnsubscribed, (track) => {
        track.detach().forEach((element) => element.remove());
      });

      room.on(RoomEvent.Disconnected, () => {
        setConnected(false);
        setMicEnabled(false);
        setParticipantCount(0);
      });

      await room.connect(data.serverUrl, data.token);
      await room.localParticipant.setMicrophoneEnabled(true);

      setConnected(true);
      setMicEnabled(true);
      setParticipantCount(1 + room.remoteParticipants.size);
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
    void checkBackend();

    return () => {
      roomRef.current?.disconnect();
      roomRef.current = null;
    };
  }, []);

  return (
    <main className="app-shell">
      <header className="topbar">
        <a className="brand" href="/" aria-label="Room home">
          <span className="brand-mark">r.</span>
          <span>room</span>
        </a>

        <div className="topbar-center">
          <span className={`connection-indicator ${apiStatus}`} />
          <span>
            {apiStatus === "online"
              ? "Systems operational"
              : apiStatus === "checking"
                ? "Checking systems"
                : apiStatus === "offline"
                  ? "Backend offline"
                  : "Connecting to systems"}
          </span>
        </div>

        <a className="topbar-link" href="#debate">
          Enter a room <span aria-hidden="true">↗</span>
        </a>
      </header>

      <section className="hero-layout">
        <div className="hero-copy">
          <div className="eyebrow">
            <span className="eyebrow-line" />
            THE ART OF DISAGREEMENT
          </div>

          <h1>
            Good ideas
            <br />
            deserve a <span>challenge.</span>
          </h1>

          <p className="hero-description">
            A place to question assumptions, defend your reasoning, and
            understand another point of view. One conversation at a time.
          </p>

          <a className="hero-cta" href="#debate">
            Start a debate <span aria-hidden="true">↓</span>
          </a>

          <div className="hero-note">
            <span className="note-symbol">✳</span>
            Better arguments. Better understanding.
          </div>
        </div>

        <aside className="manifesto-card">
          <div className="manifesto-top">
            <span>ROOM PRINCIPLES</span>
            <span>001 — 003</span>
          </div>

          <div className="principle">
            <span className="principle-number">01</span>
            <div>
              <h3>Listen first.</h3>
              <p>Understand the argument before challenging it.</p>
            </div>
          </div>

          <div className="principle">
            <span className="principle-number">02</span>
            <div>
              <h3>Question clearly.</h3>
              <p>Good questions move a conversation forward.</p>
            </div>
          </div>

          <div className="principle">
            <span className="principle-number">03</span>
            <div>
              <h3>Disagree better.</h3>
              <p>Challenge ideas, not the person sharing them.</p>
            </div>
          </div>

          <div className="manifesto-footer">
            <span>THINK IN PUBLIC.</span>
            <span aria-hidden="true">✳</span>
          </div>
        </aside>
      </section>

      <section className="workspace" id="debate">
        <div className="section-heading">
          <div>
            <p className="section-kicker">YOUR NEXT CONVERSATION</p>
            <h2>Enter the room<span>.</span></h2>
          </div>
          <p className="section-description">
            Open the same room on two devices to start talking.
          </p>
        </div>

        <div className="debate-layout">
          <div className="room-card">
            <div className="room-card-header">
              <div>
                <span className="live-label">
                  <span className={`connection-indicator ${connected ? "online" : ""}`} />
                  {connected ? "SESSION LIVE" : "AUDIO SESSION"}
                </span>
                <h3>{connected ? "You're in the room." : "Take your seat."}</h3>
              </div>
              <span className="room-index">ROOM / 01</span>
            </div>

            <div className="participant-grid">
              <div className={`participant-card ${connected ? "participant-active" : ""}`}>
                <div className="avatar avatar-you">YOU</div>
                <div className="participant-meta">
                  <span className="participant-role">PARTICIPANT 01</span>
                  <strong>{identity.trim() || "Your name"}</strong>
                  <span className="participant-state">
                    <span className={`mini-dot ${connected ? "active" : ""}`} />
                    {connected ? (micEnabled ? "Microphone on" : "Microphone muted") : "Not connected"}
                  </span>
                </div>
              </div>

              <div className={`participant-card ${participantCount > 1 ? "participant-active" : ""}`}>
                <div className="avatar avatar-opponent">
                  <span>+</span>
                </div>
                <div className="participant-meta">
                  <span className="participant-role">PARTICIPANT 02</span>
                  <strong>{participantCount > 1 ? "Opponent connected" : "Your opponent"}</strong>
                  <span className="participant-state">
                    <span className={`mini-dot ${participantCount > 1 ? "active" : ""}`} />
                    {participantCount > 1 ? "In the room" : "Waiting to join"}
                  </span>
                </div>
              </div>
            </div>

            <form className="room-form" onSubmit={joinCall}>
              <div className="form-row">
                <label>
                  Room name
                  <input
                    value={roomName}
                    onChange={(event) => setRoomName(event.target.value)}
                    placeholder="room-test"
                    required
                    disabled={connected || connecting}
                    maxLength={64}
                  />
                </label>

                <label>
                  Your display name
                  <input
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
                  className="join-button"
                  type="submit"
                  disabled={connecting}
                >
                  <span>{connecting ? "Connecting to room..." : "Join audio room"}</span>
                  <span className="button-arrow" aria-hidden="true">
                    {connecting ? "···" : "↗"}
                  </span>
                </button>
              ) : (
                <div className="call-controls">
                  <button
                    className="secondary-button"
                    type="button"
                    onClick={toggleMicrophone}
                  >
                    {micEnabled ? "Mute microphone" : "Unmute microphone"}
                  </button>
                  <button
                    className="leave-button"
                    type="button"
                    onClick={leaveCall}
                  >
                    Leave room <span aria-hidden="true">×</span>
                  </button>
                </div>
              )}
            </form>

            <div className="room-footer">
              <span>
                <span className={`mini-dot ${connected ? "active" : ""}`} />
                {connecting
                  ? "Establishing connection"
                  : connected
                    ? `${participantCount} participant${participantCount === 1 ? "" : "s"} connected`
                    : "Microphone access required"}
              </span>
              <span>LIVEKIT AUDIO</span>
            </div>

            {error && <p className="error-message" role="alert">{error}</p>}
            <div ref={remoteAudioRef} />
          </div>

          <aside className="guide-card">
            <span className="guide-number">BEFORE YOU BEGIN</span>
            <h3>A good debate starts with showing up.</h3>

            <div className="guide-step">
              <span>01</span>
              <p>Choose a room name and share it with your opponent.</p>
            </div>
            <div className="guide-step">
              <span>02</span>
              <p>Allow microphone access when your browser asks.</p>
            </div>
            <div className="guide-step">
              <span>03</span>
              <p>Both participants must join the same room name.</p>
            </div>

            <div className="connection-box">
              <div className="connection-box-top">
                <span className={`connection-indicator ${apiStatus}`} />
                <strong>Backend connection</strong>
              </div>
              <p>
                {apiStatus === "online"
                  ? "Your Room API is responding."
                  : apiStatus === "checking"
                    ? "Checking the Room API..."
                    : apiStatus === "offline"
                      ? "Cannot reach the API. Check Docker and your network."
                      : "Waiting for connection status."}
              </p>
              <button
                className="text-button"
                type="button"
                onClick={checkBackend}
                disabled={apiStatus === "checking"}
              >
                Check again <span aria-hidden="true">↗</span>
              </button>
            </div>
          </aside>
        </div>
      </section>

      <footer className="footer">
        <a className="footer-brand" href="/">room<span>.</span></a>
        <p>Made for thoughtful disagreement.</p>
        <span>© 2026 ROOM PROJECT</span>
      </footer>
    </main>
  );
}
