import { useState, type FormEvent } from "react";
import { Link } from "react-router";
import { Button } from "../../components/Button";
import { TextField } from "../../components/Field";
import { Kicker } from "../../components/Kicker";
import type { JoinRoomResult } from "./types";

const failureMessage: Record<Extract<JoinRoomResult, { ok: false }>["reason"], string> = {
  invalid: "That code doesn't match any room. Check it with your opponent.",
  expired: "This invite has expired. Ask your opponent for a new one.",
  full: "This room already has two participants.",
};

export function JoinRoomCard({ onJoin }: { onJoin: (code: string) => Promise<JoinRoomResult> }) {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [joined, setJoined] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = code.trim();
    if (!trimmed) {
      setError("Enter the invite code your opponent sent you.");
      return;
    }

    setError("");
    setSubmitting(true);
    try {
      const result = await onJoin(trimmed);
      if (result.ok) setJoined(true);
      else setError(failureMessage[result.reason]);
    } catch {
      setError("Could not reach the server. Try again in a moment.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section aria-labelledby="join-heading" className="flex min-w-0 flex-col rounded-[10px] bg-sand p-5 sm:p-7.5">
      <Kicker className="text-[9px]">GOT AN INVITE?</Kicker>
      <h2 id="join-heading" className="mt-3 font-display text-[22px] font-bold tracking-[-1px]">
        Join a debate.
      </h2>
      <p className="mt-1.5 mb-5 text-xs leading-[1.7] text-muted">
        Paste the code your opponent shared. Each room holds exactly two people.
      </p>

      {joined ? (
        <p role="status" className="rounded-[7px] border border-olive-light bg-[#fbfdef] p-4 text-xs leading-[1.7]">
          You're in. The waiting room comes next; for now you can{" "}
          <Link to="/room/sample" className="font-bold underline underline-offset-2">
            preview the debate room
          </Link>
          .
        </p>
      ) : (
        <form noValidate onSubmit={submit} className="grid gap-4">
          <TextField
            label="Invite code"
            value={code}
            onChange={(event) => setCode(event.target.value)}
            placeholder="XXXX-XXXX-XXXX"
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            maxLength={64}
            error={error}
            disabled={submitting}
            className="font-mono tracking-[1px] uppercase placeholder:normal-case"
          />
          <Button type="submit" disabled={submitting}>
            {submitting ? "Checking code..." : "Join room"}
          </Button>
        </form>
      )}
    </section>
  );
}
