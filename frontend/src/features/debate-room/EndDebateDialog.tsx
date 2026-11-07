import { useEffect, useRef, type KeyboardEvent } from "react";
import { Button } from "../../components/Button";

type EndDebateDialogProps = {
  open: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

// Custom modal instead of <dialog>.showModal so it behaves the same in every target browser and in tests.
export function EndDebateDialog({ open, onCancel, onConfirm }: EndDebateDialogProps) {
  const cancelRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    cancelRef.current?.focus();
    return () => previous?.focus();
  }, [open]);

  if (!open) return null;

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      event.stopPropagation();
      onCancel();
      return;
    }
    if (event.key !== "Tab") return;

    // Keep focus inside the dialog.
    const focusable = panelRef.current?.querySelectorAll<HTMLElement>("button:not(:disabled)");
    if (!focusable || focusable.length === 0) return;
    const first = focusable[0]!;
    const last = focusable[focusable.length - 1]!;
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  return (
    <div className="fixed inset-0 z-40 grid place-items-center bg-[rgb(32_33_30/45%)] p-4" onMouseDown={onCancel}>
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="end-title"
        aria-describedby="end-description"
        onKeyDown={onKeyDown}
        onMouseDown={(event) => event.stopPropagation()}
        className="w-full max-w-100 rounded-[10px] bg-card p-6 shadow-[0_24px_70px_rgb(32_33_30/25%)]"
      >
        <h2 id="end-title" className="font-display text-xl font-bold tracking-[-0.5px]">
          End the debate for both of you?
        </h2>
        <p id="end-description" className="mt-2.5 text-xs leading-[1.7] text-muted">
          Audio stops, the transcript is deleted from this browser and the AI evaluation starts. This can't be undone.
        </p>
        <div className="mt-6 flex flex-col-reverse gap-2.5 sm:flex-row sm:justify-end">
          <Button ref={cancelRef} variant="outline" onClick={onCancel}>
            Keep debating
          </Button>
          <Button variant="danger" onClick={onConfirm}>
            End debate
          </Button>
        </div>
      </div>
    </div>
  );
}
