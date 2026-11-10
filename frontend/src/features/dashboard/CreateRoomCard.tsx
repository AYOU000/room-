import { useId, useState, type FormEvent } from "react";
import { Button } from "../../components/Button";
import { CharCount, TextAreaField, TextField } from "../../components/Field";
import { Kicker } from "../../components/Kicker";
import type { CreateRoomInput, CreateRoomResult } from "./types";

// Limits from SRS page 3 "Proposed field defaults".
export const TOPIC_MIN = 5;
export const TOPIC_MAX = 200;
export const DESCRIPTION_MAX = 2000;
export const DURATION_MIN = 2;
export const DURATION_MAX = 30;
export const DURATION_DEFAULT = 10;

type Errors = Partial<Record<"topic" | "description" | "form", string>>;

function validate(input: CreateRoomInput): Errors {
  const errors: Errors = {};
  const topic = input.topic.trim();
  if (topic.length < TOPIC_MIN) errors.topic = `Write at least ${TOPIC_MIN} characters.`;
  else if (topic.length > TOPIC_MAX) errors.topic = `Keep the topic under ${TOPIC_MAX} characters.`;
  if (input.description.length > DESCRIPTION_MAX)
    errors.description = `Keep the description under ${DESCRIPTION_MAX.toLocaleString("en")} characters.`;
  return errors;
}

function InviteReady({ result, onReset }: { result: CreateRoomResult; onReset: () => void }) {
  const [copyStatus, setCopyStatus] = useState("");

  async function copy() {
    try {
      await navigator.clipboard.writeText(result.inviteCode);
      setCopyStatus("Invite code copied.");
    } catch {
      setCopyStatus("Copy failed. Select the code and copy it manually.");
    }
  }

  return (
    <div className="grid gap-4">
      <div className="rounded-[7px] border border-olive-light bg-[#fbfdef] p-4">
        <p className="text-[11px] font-bold text-[#55574f]">Invite code</p>
        <p className="mt-2 font-mono text-[22px] font-bold tracking-[2px] break-all select-all">{result.inviteCode}</p>
        <p className="mt-2 text-[11px] leading-normal text-muted">
          Share it with your opponent. It expires in 24 hours or when the room closes.
        </p>
      </div>
      <div className="flex flex-wrap gap-2.5">
        <Button variant="accent" className="flex-1" onClick={() => void copy()}>
          Copy code
        </Button>
        <Button variant="outline" className="flex-1" onClick={onReset}>
          Create another room
        </Button>
      </div>
      <p role="status" className="min-h-4 text-[11px] text-muted">
        {copyStatus}
      </p>
    </div>
  );
}

export function CreateRoomCard({ onCreate }: { onCreate: (input: CreateRoomInput) => Promise<CreateRoomResult> }) {
  const [topic, setTopic] = useState("");
  const [description, setDescription] = useState("");
  const [duration, setDuration] = useState(DURATION_DEFAULT);
  const [errors, setErrors] = useState<Errors>({});
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<CreateRoomResult | null>(null);
  const durationId = useId();

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const input = { topic: topic.trim(), description, durationMinutes: duration };
    const found = validate(input);
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    setSubmitting(true);
    try {
      setResult(await onCreate(input));
    } catch {
      setErrors({ form: "Could not create the room. Try again in a moment." });
    } finally {
      setSubmitting(false);
    }
  }

  function reset() {
    setTopic("");
    setDescription("");
    setDuration(DURATION_DEFAULT);
    setErrors({});
    setResult(null);
  }

  return (
    <section
      aria-labelledby="create-heading"
      className="flex min-w-0 flex-col rounded-[10px] border border-[#e3e1d9] bg-card p-5 sm:p-7.5"
    >
      <Kicker className="text-[9px]">NEW DEBATE</Kicker>
      <h2 id="create-heading" className="mt-3 font-display text-[22px] font-bold tracking-[-1px]">
        {result ? "Your room is ready." : "Start a debate."}
      </h2>
      <p className="mt-1.5 mb-5 text-xs leading-[1.7] text-muted">
        {result
          ? "Your opponent joins with the code below."
          : "Pick a topic and a length. You can still change both before the debate starts."}
      </p>

      {result ? (
        <InviteReady result={result} onReset={reset} />
      ) : (
        <form noValidate onSubmit={submit} className="grid gap-4.5">
          <TextField
            label="Topic"
            value={topic}
            onChange={(event) => setTopic(event.target.value)}
            placeholder="e.g. Remote work makes teams more productive"
            error={errors.topic}
            hint={`Between ${TOPIC_MIN} and ${TOPIC_MAX} characters.`}
            aside={<CharCount value={topic} max={TOPIC_MAX} />}
            disabled={submitting}
          />

          <TextAreaField
            label="Description (optional)"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Context or rules both sides should know"
            error={errors.description}
            aside={<CharCount value={description} max={DESCRIPTION_MAX} />}
            disabled={submitting}
            rows={3}
          />

          <div className="grid gap-2">
            <div className="flex items-baseline justify-between">
              <label htmlFor={durationId} className="text-[11px] font-bold text-[#55574f]">
                Duration
              </label>
              <output htmlFor={durationId} className="text-[13px] font-bold tabular-nums">
                {duration} min
              </output>
            </div>
            <input
              id={durationId}
              type="range"
              min={DURATION_MIN}
              max={DURATION_MAX}
              step={1}
              value={duration}
              onChange={(event) => setDuration(Number(event.target.value))}
              aria-valuetext={`${duration} minutes`}
              disabled={submitting}
              className="h-6 w-full cursor-pointer accent-ink"
            />
            <div className="flex justify-between text-[10px] text-faint" aria-hidden="true">
              <span>{DURATION_MIN} min</span>
              <span>{DURATION_MAX} min</span>
            </div>
          </div>

          {errors.form && (
            <p role="alert" className="rounded-[5px] border border-danger-line bg-[#fff4f1] px-3 py-2.75 text-xs text-danger">
              {errors.form}
            </p>
          )}

          <Button type="submit" disabled={submitting} className="justify-between">
            <span>{submitting ? "Creating room..." : "Create room"}</span>
            <span aria-hidden="true" className="grid size-6.75 place-items-center rounded bg-accent text-[15px] text-ink">
              {submitting ? "···" : "↗"}
            </span>
          </Button>
        </form>
      )}
    </section>
  );
}
