import { Link } from "react-router";
import { Kicker } from "../../components/Kicker";
import type { EndReason } from "./types";

const reasonText: Record<EndReason, { title: string; body: string }> = {
  timer: { title: "Time's up.", body: "The debate ran its full length." },
  user_end: { title: "Debate ended.", body: "A participant ended the debate early." },
  disconnect: {
    title: "Debate interrupted.",
    body: "A participant didn't reconnect within 60 seconds. The evaluation may be unavailable if speech is missing.",
  },
  service_failure: {
    title: "Debate interrupted.",
    body: "A service failed during the debate. No score is shown if the transcript is incomplete.",
  },
};

export function DebateEnded({ reason, topic }: { reason: EndReason; topic: string }) {
  const text = reasonText[reason];

  return (
    <section aria-labelledby="ended-heading" className="mx-auto max-w-150 py-12 text-center sm:py-20">
      <Kicker className="justify-center">SESSION CLOSED</Kicker>
      <h1 id="ended-heading" className="mt-4 font-display text-[clamp(32px,5vw,46px)] font-bold tracking-[-2px]">
        {text.title}
      </h1>
      <p className="mx-auto mt-3 max-w-110 text-sm leading-[1.8] text-muted">{text.body}</p>
      <p className="mx-auto mt-1 max-w-110 text-xs leading-[1.8] wrap-break-word text-faint">“{topic}”</p>

      <div className="mt-8 grid gap-3 text-left sm:grid-cols-2">
        <div className="rounded-[9px] border border-line bg-card p-4">
          <p className="text-[11px] font-bold">Transcript deleted</p>
          <p className="mt-1.5 text-[11px] leading-normal text-muted">
            The live text was removed from this browser. Room never saves it to its database.
          </p>
        </div>
        <div className="rounded-[9px] border border-line bg-card p-4">
          <p className="flex items-center gap-2 text-[11px] font-bold">
            <span aria-hidden="true" className="size-1.5 animate-pulse rounded-full bg-warn" />
            Evaluating…
          </p>
          <p className="mt-1.5 text-[11px] leading-normal text-muted">
            The AI is scoring both sides and checking claims. This usually takes under a minute.
          </p>
        </div>
      </div>

      <div className="mt-8 flex flex-col justify-center gap-2.5 sm:flex-row">
        {/* Result page not built yet; this becomes a link to /sessions/:id/result. */}
        <span className="inline-flex min-h-11.5 items-center justify-center rounded-[5px] border border-dashed border-[#c9c9bd] px-4 text-xs font-bold text-faint">
          Results page coming soon
        </span>
        <Link
          to="/dashboard"
          className="inline-flex min-h-11.5 items-center justify-center rounded-[5px] bg-ink px-4 text-xs font-bold text-white transition-colors hover:bg-ink-hover"
        >
          Back to dashboard
        </Link>
      </div>
    </section>
  );
}
