import type { RoomScenario } from "./types";

const scenarios: { value: RoomScenario; label: string }[] = [
  { value: "live", label: "Live" },
  { value: "opponent-disconnected", label: "Opponent dropped" },
  { value: "you-reconnecting", label: "You reconnecting" },
  { value: "transcription-degraded", label: "ASR degraded" },
  { value: "mic-blocked", label: "Mic blocked" },
  { value: "ended", label: "Ended" },
];

// Design-preview only: lets the team look at every room state without a backend.
export function ScenarioSwitcher({ value, onChange }: { value: RoomScenario; onChange: (value: RoomScenario) => void }) {
  return (
    <fieldset className="rounded-[9px] border border-dashed border-[#c9c9bd] px-4 pt-2 pb-3.5">
      <legend className="px-1.5 text-[9px] font-bold tracking-[1px] text-faint">SAMPLE DATA · PREVIEW STATE</legend>
      <div className="flex flex-wrap gap-2">
        {scenarios.map((scenario) => (
          <label
            key={scenario.value}
            className="cursor-pointer rounded-full border border-line bg-card px-3 py-1.5 text-[11px] font-bold text-muted transition-colors has-checked:border-ink has-checked:bg-ink has-checked:text-white has-focus-visible:outline-3 has-focus-visible:outline-focus"
          >
            <input
              type="radio"
              name="room-scenario"
              value={scenario.value}
              checked={value === scenario.value}
              onChange={() => onChange(scenario.value)}
              className="sr-only"
            />
            {scenario.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
