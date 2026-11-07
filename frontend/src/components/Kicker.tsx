import type { ReactNode } from "react";

export function Kicker({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <p className={`flex items-center gap-2.5 text-[10px] font-bold tracking-[1.5px] text-muted ${className}`}>
      {children}
    </p>
  );
}
