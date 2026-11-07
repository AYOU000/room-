import type { EvaluationStatus, RecentDebate, SessionStatus } from "./types";

const dateFormat = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" });

const sessionLabel: Record<SessionStatus, { text: string; className: string }> = {
  completed: { text: "Completed", className: "border-olive-light bg-[#fbfdef] text-[#52642e]" },
  interrupted: { text: "Interrupted", className: "border-[#ecd9a8] bg-[#fdf8ea] text-[#7a5a12]" },
  cancelled: { text: "Cancelled", className: "border-line bg-surface text-muted" },
};

const evaluationText: Record<Exclude<EvaluationStatus, "completed">, string> = {
  pending: "Evaluation queued",
  processing: "Evaluating…",
  failed: "Evaluation failed",
  unavailable: "No evaluation",
};

function Result({ debate }: { debate: RecentDebate }) {
  if (debate.evaluation !== "completed" || !debate.scores) {
    return <span className="text-[11px] text-muted">{evaluationText[debate.evaluation as keyof typeof evaluationText]}</span>;
  }

  const { you, opponent } = debate.scores;
  const outcome = you === opponent ? "Tie" : you > opponent ? "Higher score" : "Lower score";
  return (
    <span className="flex items-baseline gap-2 whitespace-nowrap">
      <span className="text-[15px] font-semibold tabular-nums">
        {you} <span className="text-faint">–</span> {opponent}
      </span>
      <span className="text-[10px] text-muted">{outcome}</span>
    </span>
  );
}

export function RecentDebates({ debates }: { debates: RecentDebate[] }) {
  return (
    <section aria-labelledby="recent-heading" className="rounded-[10px] border border-[#e3e1d9] bg-card">
      <div className="flex items-end justify-between gap-4 border-b border-line px-5 pt-5 pb-4 sm:px-7.5 sm:pt-6.5">
        <div>
          <h2 id="recent-heading" className="font-display text-[22px] font-bold tracking-[-1px]">
            Recent debates
          </h2>
          <p className="mt-1 text-[11px] text-muted">Only you and your opponent can see these.</p>
        </div>
        {/* History page is not built yet; this becomes a router Link to /history. */}
        <span className="text-[11px] font-bold whitespace-nowrap text-faint">Full history soon</span>
      </div>

      {debates.length === 0 ? (
        <p className="px-5 py-10 text-center text-xs text-muted sm:px-7.5">
          No debates yet. Start one above, or join with an invite code.
        </p>
      ) : (
        <ul>
          {debates.map((debate) => {
            const status = sessionLabel[debate.status];
            return (
              <li
                key={debate.sessionId}
                className="grid gap-3 border-b border-line px-5 py-4 last:border-b-0 sm:grid-cols-[1fr_auto] sm:items-center sm:gap-6 sm:px-7.5"
              >
                <div className="min-w-0">
                  <p className="text-[13px] leading-snug font-bold wrap-break-word">{debate.topic}</p>
                  <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted">
                    <span>vs {debate.opponentName}</span>
                    <span aria-hidden="true">·</span>
                    <time dateTime={debate.startedAt}>{dateFormat.format(new Date(debate.startedAt))}</time>
                    <span aria-hidden="true">·</span>
                    <span>{debate.durationMinutes} min</span>
                  </p>
                </div>
                <div className="flex items-center justify-between gap-4 sm:justify-end">
                  <span className={`rounded border px-2 py-1 text-[10px] font-bold ${status.className}`}>{status.text}</span>
                  <div className="sm:w-36 sm:text-right">
                    <Result debate={debate} />
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
