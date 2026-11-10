import { useId } from "react";
import { Button } from "../../components/Button";
import { controlClass } from "../../components/Field";
import type { MicDevice } from "./types";

type MicControlsProps = {
  muted: boolean;
  blocked: boolean;
  disabled: boolean;
  devices: MicDevice[];
  deviceId: string;
  onToggleMute: () => void;
  onDeviceChange: (id: string) => void;
  onRetryPermission: () => void;
  onEnd: () => void;
};

export function MicControls({
  muted,
  blocked,
  disabled,
  devices,
  deviceId,
  onToggleMute,
  onDeviceChange,
  onRetryPermission,
  onEnd,
}: MicControlsProps) {
  const selectId = useId();

  if (blocked) {
    return (
      <div role="alert" className="rounded-[10px] border border-danger-line bg-[#fff4f1] p-5">
        <strong className="text-sm text-danger">Microphone blocked</strong>
        <p className="mt-2 text-xs leading-[1.7] text-[#6e3a32]">
          Room can't hear you. Open your browser's site settings (the icon left of the address bar), allow the
          microphone, then try again. Your opponent sees you as muted until then.
        </p>
        <div className="mt-4 flex flex-wrap gap-2.5">
          <Button variant="primary" onClick={onRetryPermission}>
            Try again
          </Button>
          <Button variant="danger" onClick={onEnd}>
            End debate
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-3 rounded-[10px] border border-[#e3e1d9] bg-card p-4 sm:grid-cols-[auto_1fr_auto] sm:items-end sm:p-5">
      <Button
        variant={muted ? "danger" : "accent"}
        aria-pressed={muted}
        onClick={onToggleMute}
        disabled={disabled}
        className="sm:min-w-40"
      >
        {muted ? "Unmute microphone" : "Mute microphone"}
      </Button>

      <div className="grid min-w-0 gap-1.5">
        <label htmlFor={selectId} className="text-[10px] font-bold text-[#55574f]">
          Microphone
        </label>
        <select
          id={selectId}
          value={deviceId}
          onChange={(event) => onDeviceChange(event.target.value)}
          disabled={disabled}
          className={`h-11.5 ${controlClass}`}
        >
          {devices.map((device) => (
            <option key={device.id} value={device.id}>
              {device.label}
            </option>
          ))}
        </select>
      </div>

      <Button variant="danger" onClick={onEnd} disabled={disabled}>
        End debate <span aria-hidden="true">×</span>
      </Button>
    </div>
  );
}
