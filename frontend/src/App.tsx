import { useState } from "react";

type ApiStatus = "idle" | "checking" | "online" | "offline";

export default function App() {
  const [apiStatus, setApiStatus] = useState<ApiStatus>("idle");

  async function checkBackend() {
    setApiStatus("checking");

    try {
      const response = await fetch("/api/health");

      if (!response.ok) {
        throw new Error("API request failed");
      }

      const data = await response.json();

      setApiStatus(data.status === "ok" ? "online" : "offline");
    } catch {
      setApiStatus("offline");
    }
  }

  return (
    <main className="page">
      <nav className="navbar">
        <a className="brand" href="/">room<span>.</span></a>
        <span className="nav-label">REAL-TIME DEBATE</span>
      </nav>

      <section className="hero">
        <div className="eyebrow">
          <span className="live-dot" />
          A SPACE FOR IDEAS
        </div>

        <h1>
          Think clearly.
          <br />
          <span>Debate openly.</span>
        </h1>

        <p className="description">
          Two perspectives. One conversation.
          <br />
          A better way to challenge ideas and learn together.
        </p>

        <div className="actions">
          <button className="primary-button" onClick={checkBackend}>
            {apiStatus === "checking" ? "Checking..." : "Check connection"}
            <span aria-hidden="true"> ↗</span>
          </button>
        </div>

        <div className="status">
          <span
            className={`status-dot ${
              apiStatus === "online"
                ? "online"
                : apiStatus === "offline"
                  ? "offline"
                  : ""
            }`}
          />
          {apiStatus === "online"
            ? "Backend connected successfully"
            : apiStatus === "offline"
              ? "Backend unavailable — check Docker logs"
              : "Ready when you are"}
        </div>
      </section>

      <section className="features">
        <article className="feature-card">
          <span className="feature-number">01</span>
          <h2>One topic</h2>
          <p>Focus the conversation around a clear question or claim.</p>
        </article>

        <article className="feature-card">
          <span className="feature-number">02</span>
          <h2>Two voices</h2>
          <p>Meet another perspective in a real-time audio debate.</p>
        </article>

        <article className="feature-card">
          <span className="feature-number">03</span>
          <h2>Better thinking</h2>
          <p>Challenge arguments, explain your reasoning, and learn.</p>
        </article>
      </section>

      <footer>
        <span>ROOM © 2026</span>
        <span>BUILT FOR BETTER CONVERSATIONS</span>
      </footer>
    </main>
  );
}