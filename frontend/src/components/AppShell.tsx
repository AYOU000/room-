import { Link, Outlet } from "react-router";
import { ApiHealthProvider, apiStatusTone, useApiHealth, type ApiStatus } from "../lib/api-health";
import { StatusDot } from "./StatusDot";

const statusLabel: Record<ApiStatus, string> = {
  idle: "Connecting to systems",
  checking: "Checking systems",
  online: "Systems operational",
  offline: "Backend offline",
};

function Topbar() {
  const { status } = useApiHealth();

  return (
    <header className="flex h-17 items-center justify-between border-b border-line sm:h-20.5">
      <Link
        to="/"
        aria-label="Room home"
        className="inline-flex items-center gap-2 font-display text-[19px] font-extrabold tracking-[-1.1px] sm:gap-2.5 sm:text-[21px]"
      >
        <span className="grid size-7.75 place-items-center rounded-[10px] bg-ink text-[21px] text-accent sm:size-8.5">
          r.
        </span>
        <span>room</span>
      </Link>

      <p role="status" className="flex items-center gap-1.5 text-[10px] text-muted sm:gap-2.25 sm:text-xs">
        <StatusDot tone={apiStatusTone[status]} />
        {statusLabel[status]}
      </p>

      <Link to="/dashboard" className="group flex items-center gap-1.5 text-[11px] font-bold sm:gap-3 sm:text-[13px]">
        Dashboard
        <span
          aria-hidden="true"
          className="grid size-6.25 place-items-center rounded-full border border-line transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:bg-accent sm:size-7.5"
        >
          ↗
        </span>
      </Link>
    </header>
  );
}

function Footer() {
  return (
    <footer className="flex flex-wrap items-center justify-between gap-5 border-t border-line py-5 sm:min-h-21.25 sm:flex-nowrap sm:py-0">
      <Link to="/" className="font-display text-[19px] font-extrabold tracking-[-1px]">
        room<span className="text-olive">.</span>
      </Link>
      <p className="order-3 m-0 w-full text-[10px] text-faint sm:order-0 sm:w-auto">
        Made for thoughtful disagreement.
      </p>
      <span className="text-[10px] font-bold tracking-[0.7px] text-faint">© 2026 ROOM PROJECT</span>
    </footer>
  );
}

export function AppShell() {
  return (
    <ApiHealthProvider>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded focus:bg-ink focus:px-3 focus:py-2 focus:text-sm focus:text-white"
      >
        Skip to content
      </a>
      <div className="mx-auto w-[calc(100%-36px)] sm:w-[min(1160px,calc(100%-64px))]">
        <Topbar />
        <main id="main">
          <Outlet />
        </main>
        <Footer />
      </div>
    </ApiHealthProvider>
  );
}
