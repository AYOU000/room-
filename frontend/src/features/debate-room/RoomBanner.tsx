import type { ReactNode } from "react";

type Tone = "caution" | "danger";

const toneClass: Record<Tone, string> = {
  caution: "border-caution-line bg-caution-bg text-caution",
  danger: "border-danger-line bg-[#fff4f1] text-danger",
};

export function RoomBanner({ tone, title, children }: { tone: Tone; title: string; children: ReactNode }) {
  return (
    <div role="alert" className={`flex items-start gap-3 rounded-[7px] border px-4 py-3 ${toneClass[tone]}`}>
      <span aria-hidden="true" className="mt-0.5 grid size-4 shrink-0 place-items-center rounded-full border border-current text-[10px] font-bold">
        !
      </span>
      <p className="text-xs leading-[1.6]">
        <strong className="font-bold">{title}</strong> <span className="opacity-90">{children}</span>
      </p>
    </div>
  );
}
