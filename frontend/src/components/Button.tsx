import type { ComponentProps } from "react";

type Variant = "primary" | "accent" | "danger" | "outline";

const variantClass: Record<Variant, string> = {
  primary: "bg-ink text-white enabled:hover:bg-ink-hover",
  accent: "border border-[#d9ddc8] bg-accent text-ink enabled:hover:bg-accent-hover",
  danger: "border border-[#ead4cf] bg-danger-bg text-danger enabled:hover:bg-[#fbe8e3]",
  outline: "border border-line bg-card text-ink enabled:hover:border-olive-light enabled:hover:bg-surface",
};

type ButtonProps = ComponentProps<"button"> & { variant?: Variant };

export function Button({ variant = "primary", className = "", type = "button", ...props }: ButtonProps) {
  return (
    <button
      type={type}
      className={`inline-flex min-h-11.5 items-center justify-center gap-2 rounded-[5px] px-4 text-xs font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-65 ${variantClass[variant]} ${className}`}
      {...props}
    />
  );
}
