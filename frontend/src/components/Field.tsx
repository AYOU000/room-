import { useId, type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes } from "react";

export const controlClass =
  "w-full min-w-0 rounded-[5px] border border-[#e1dfd6] bg-card px-3 text-[13px] text-ink outline-none transition-colors placeholder:text-[#a1a198] focus:border-[#8b9b50] focus:outline-3 focus:outline-[rgb(139_155_80/12%)] disabled:bg-[#f2f1eb] disabled:text-[#73746d] aria-invalid:border-danger";

type FieldShellProps = {
  id: string;
  label: string;
  hint?: ReactNode;
  error?: string;
  aside?: ReactNode;
  children: ReactNode;
};

function FieldShell({ id, label, hint, error, aside, children }: FieldShellProps) {
  return (
    <div className="grid gap-2">
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="text-[11px] font-bold text-[#55574f]">
          {label}
        </label>
        {aside}
      </div>
      {children}
      {error ? (
        <p id={`${id}-error`} className="text-[11px] leading-normal text-danger">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-[11px] leading-normal text-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

function describedBy(id: string, hint?: ReactNode, error?: string) {
  if (error) return `${id}-error`;
  if (hint) return `${id}-hint`;
  return undefined;
}

type TextFieldProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  hint?: ReactNode;
  error?: string;
  aside?: ReactNode;
};

export function TextField({ label, hint, error, aside, className = "", ...props }: TextFieldProps) {
  const id = useId();
  return (
    <FieldShell id={id} label={label} hint={hint} error={error} aside={aside}>
      <input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, hint, error)}
        className={`h-11.25 ${controlClass} ${className}`}
        {...props}
      />
    </FieldShell>
  );
}

type TextAreaFieldProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label: string;
  hint?: ReactNode;
  error?: string;
  aside?: ReactNode;
};

export function TextAreaField({ label, hint, error, aside, className = "", ...props }: TextAreaFieldProps) {
  const id = useId();
  return (
    <FieldShell id={id} label={label} hint={hint} error={error} aside={aside}>
      <textarea
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, hint, error)}
        className={`min-h-20 resize-y py-2.5 leading-relaxed ${controlClass} ${className}`}
        {...props}
      />
    </FieldShell>
  );
}

export function CharCount({ value, max }: { value: string; max: number }) {
  const over = value.length > max;
  return (
    <span className={`text-[10px] tabular-nums ${over ? "font-bold text-danger" : "text-faint"}`}>
      {value.length} / {max}
    </span>
  );
}
