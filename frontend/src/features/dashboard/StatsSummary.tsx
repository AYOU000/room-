import type { DashboardStats } from "./types";

type Tile = { label: string; value: string; detail: string };

function toTiles(stats: DashboardStats): Tile[] {
  return [
    { label: "Debates", value: String(stats.totalDebates), detail: "All sessions you joined" },
    {
      label: "Completed",
      value: String(stats.completedDebates),
      detail: `${stats.totalDebates - stats.completedDebates} cancelled or interrupted`,
    },
    {
      label: "Average score",
      value: stats.averageScore === null ? "—" : `${stats.averageScore}`,
      detail: stats.averageScore === null ? "No evaluated debates yet" : "Out of 100, AI-assessed",
    },
    { label: "Time debating", value: `${stats.minutesDebated} min`, detail: "Across completed sessions" },
  ];
}

export function StatsSummary({ stats }: { stats: DashboardStats }) {
  return (
    <section aria-labelledby="stats-heading">
      <h2 id="stats-heading" className="sr-only">
        Your stats
      </h2>
      <dl className="grid grid-cols-2 gap-3 tab:grid-cols-4">
        {toTiles(stats).map((tile) => (
          <div key={tile.label} className="flex flex-col rounded-[9px] border border-line bg-card px-4 py-4 sm:px-5">
            <dt className="text-[11px] font-bold text-muted">{tile.label}</dt>
            <dd className="order-first mb-2 text-[28px] leading-none font-semibold tracking-[-1px] sm:text-[32px]">
              {tile.value}
            </dd>
            <dd className="mt-1.5 text-[10px] leading-normal text-faint">{tile.detail}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
