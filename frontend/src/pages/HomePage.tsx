import { Kicker } from "../components/Kicker";
import { AudioPrototype } from "../features/audio-prototype/AudioPrototype";

const principles = [
  { title: "Listen first.", body: "Understand the argument before challenging it." },
  { title: "Question clearly.", body: "Good questions move a conversation forward." },
  { title: "Disagree better.", body: "Challenge ideas, not the person sharing them." },
];

function Hero() {
  return (
    <section className="grid items-center gap-9.5 py-16.5 sm:grid-cols-[1fr_0.85fr] sm:gap-8.75 sm:py-18.75 tab:grid-cols-[1.1fr_0.9fr] tab:gap-22.5 tab:pt-25 tab:pb-26">
      <div className="max-w-155">
        <Kicker>
          <span aria-hidden="true" className="h-0.5 w-5.75 bg-[#8a9f3c]" />
          THE ART OF DISAGREEMENT
        </Kicker>

        <h1 className="mt-5.75 mb-5.5 font-display text-[clamp(43px,11vw,61px)] leading-[1.08] font-bold tracking-[-2.8px] sm:mt-7 sm:text-[clamp(43px,6vw,60px)] sm:tracking-[-3px] tab:text-[clamp(46px,5.5vw,72px)] tab:tracking-[-4.2px]">
          Good ideas
          <br />
          deserve a <span className="text-[#818c4e]">challenge.</span>
        </h1>

        <p className="m-0 max-w-108.75 text-sm leading-[1.9] text-[#71736b] sm:text-[15px]">
          A place to question assumptions, defend your reasoning, and understand another point of view. One
          conversation at a time.
        </p>

        <a
          href="#debate"
          className="mt-7.5 inline-flex min-w-45 items-center justify-between gap-8.75 rounded-md bg-ink px-4.5 py-3.75 text-[13px] font-bold text-white transition hover:-translate-y-0.5 hover:bg-ink-hover"
        >
          Start a debate <span aria-hidden="true" className="text-accent">↓</span>
        </a>

        <p className="mt-6.75 flex items-center gap-2.5 text-[11px] text-muted sm:mt-9">
          <span aria-hidden="true" className="text-[17px] text-[#87983f]">✳</span>
          Better arguments. Better understanding.
        </p>
      </div>

      <aside
        aria-label="Room principles"
        className="rounded-[9px] border border-line bg-card px-5.5 pt-5.5 pb-5 shadow-[0_16px_50px_rgb(41_40_30/4%)] sm:px-7.25 sm:pt-6.75"
      >
        <div className="flex items-center justify-between border-b border-line pb-5.25 text-[9px] font-bold tracking-[1px] text-faint">
          <span>ROOM PRINCIPLES</span>
          <span>001 — 003</span>
        </div>

        <ol>
          {principles.map((principle, index) => (
            <li key={principle.title} className="grid grid-cols-[35px_1fr] gap-3.75 border-b border-line py-5.5">
              <span className="pt-0.75 text-[11px] font-bold text-olive">{String(index + 1).padStart(2, "0")}</span>
              <div>
                <h3 className="font-display text-lg font-bold tracking-[-0.5px]">{principle.title}</h3>
                <p className="mt-1.5 text-xs leading-[1.7] text-[#797a72]">{principle.body}</p>
              </div>
            </li>
          ))}
        </ol>

        <div className="flex items-center justify-between pt-5 text-[9px] font-bold tracking-[1px] text-faint">
          <span>THINK IN PUBLIC.</span>
          <span aria-hidden="true" className="text-[19px] text-[#87983f]">✳</span>
        </div>
      </aside>
    </section>
  );
}

export function HomePage() {
  return (
    <>
      <Hero />
      <AudioPrototype />
    </>
  );
}
