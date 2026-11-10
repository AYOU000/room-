import { Link } from "react-router";
import { Kicker } from "../components/Kicker";

export function NotFoundPage() {
  return (
    <section className="py-24">
      <Kicker>ERROR / 404</Kicker>
      <h1 className="mt-5 font-display text-[clamp(34px,5vw,52px)] font-bold tracking-[-2px]">
        This room doesn't exist<span className="text-olive">.</span>
      </h1>
      <p className="mt-3 max-w-105 text-sm leading-[1.8] text-muted">
        The link may be wrong, or you may not have access to it.
      </p>
      <Link
        to="/"
        className="mt-8 inline-flex items-center gap-6 rounded-md bg-ink px-4.5 py-3.75 text-[13px] font-bold text-white transition-colors hover:bg-ink-hover"
      >
        Back to home <span aria-hidden="true" className="text-accent">↗</span>
      </Link>
    </section>
  );
}
