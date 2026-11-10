import { Kicker } from "../components/Kicker";
import { CreateRoomCard } from "../features/dashboard/CreateRoomCard";
import { JoinRoomCard } from "../features/dashboard/JoinRoomCard";
import { RecentDebates } from "../features/dashboard/RecentDebates";
import {
  sampleCreateRoom,
  sampleJoinRoom,
  sampleRecentDebates,
  sampleStats,
  sampleUserName,
} from "../features/dashboard/sampleData";
import { StatsSummary } from "../features/dashboard/StatsSummary";

export function DashboardPage() {
  return (
    <div className="grid gap-5 pt-10 pb-14 sm:pt-13.5 sm:pb-21.25">
      <header className="mb-3 flex flex-col items-start gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Kicker className="mb-3">
            <span aria-hidden="true" className="h-0.5 w-5.75 bg-[#8a9f3c]" />
            DASHBOARD
          </Kicker>
          <h1 className="font-display text-[clamp(30px,4vw,42px)] font-bold tracking-[-2px]">
            Welcome back, {sampleUserName}
            <span className="text-olive">.</span>
          </h1>
        </div>
        <span className="rounded border border-dashed border-[#c9c9bd] px-2.5 py-1.5 text-[10px] font-bold tracking-[0.8px] text-faint">
          SAMPLE DATA
        </span>
      </header>

      <StatsSummary stats={sampleStats} />

      <div className="grid items-start gap-5 tab:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <CreateRoomCard onCreate={sampleCreateRoom} />
        <JoinRoomCard onJoin={sampleJoinRoom} />
      </div>

      <RecentDebates debates={sampleRecentDebates} />
    </div>
  );
}
