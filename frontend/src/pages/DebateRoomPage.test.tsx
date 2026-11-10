import { act, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { formatClock } from "../features/debate-room/useCountdown";
import { renderRoute } from "../test/render";

describe("formatClock", () => {
  it("rounds up to whole seconds", () => {
    expect(formatClock(600_000)).toBe("10:00");
    expect(formatClock(59_001)).toBe("01:00");
    expect(formatClock(1)).toBe("00:01");
    expect(formatClock(0)).toBe("00:00");
  });
});

describe("DebateRoomPage", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ status: "ok" }))));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const user = () => userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

  it("shows topic, timer, both speakers and the transcript", async () => {
    renderRoute("/room/sample");

    expect(screen.getByRole("heading", { level: 1, name: /remote work/i })).toBeInTheDocument();
    expect(screen.getByRole("timer")).toHaveTextContent("10:00");
    expect(screen.getByRole("article", { name: /you: amina/i })).toBeInTheDocument();
    expect(screen.getByRole("article", { name: /opponent: youssef/i })).toBeInTheDocument();

    await act(() => vi.advanceTimersByTimeAsync(3000));
    const transcript = screen.getByRole("region", { name: /live transcript/i });
    expect(within(transcript).getByText("Amina (you)")).toBeInTheDocument();
  });

  it("ends the debate when the server timer runs out", async () => {
    renderRoute("/room/sample");

    await act(() => vi.advanceTimersByTimeAsync(10 * 60_000 + 500));
    expect(screen.getByRole("heading", { name: /time's up/i })).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: /live transcript/i })).not.toBeInTheDocument();
  });

  it("asks for confirmation before ending and can be cancelled with Escape", async () => {
    const u = user();
    renderRoute("/room/sample");

    await u.click(screen.getByRole("button", { name: /end debate/i }));
    const dialog = screen.getByRole("dialog", { name: /end the debate/i });
    expect(within(dialog).getByRole("button", { name: /keep debating/i })).toHaveFocus();

    await u.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    await u.click(screen.getByRole("button", { name: /end debate/i }));
    await u.click(within(screen.getByRole("dialog")).getByRole("button", { name: /end debate/i }));
    expect(screen.getByRole("heading", { name: /debate ended/i })).toBeInTheDocument();
  });

  it("toggles mute with a pressed state and text label", async () => {
    const u = user();
    renderRoute("/room/sample");

    const mute = screen.getByRole("button", { name: /mute microphone/i });
    expect(mute).toHaveAttribute("aria-pressed", "false");
    await u.click(mute);
    expect(screen.getByRole("button", { name: /unmute microphone/i })).toHaveAttribute("aria-pressed", "true");
    expect(within(screen.getByRole("article", { name: /you: amina/i })).getByText("Muted")).toBeInTheDocument();
  });

  it("counts down the 60 second grace period and ends as interrupted", async () => {
    const u = user();
    renderRoute("/room/sample");

    await u.click(screen.getByRole("radio", { name: /opponent dropped/i }));
    expect(screen.getByText(/youssef lost connection/i)).toBeInTheDocument();
    expect(within(screen.getByRole("article", { name: /opponent/i })).getByText(/disconnected · 01:00 left/i)).toBeInTheDocument();

    await act(() => vi.advanceTimersByTimeAsync(61_000));
    expect(screen.getByRole("heading", { name: /debate interrupted/i })).toBeInTheDocument();
  });

  it("explains a blocked microphone", async () => {
    const u = user();
    renderRoute("/room/sample");

    await u.click(screen.getByRole("radio", { name: /mic blocked/i }));
    expect(screen.getByText(/microphone blocked/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /try again/i })).toBeInTheDocument();
  });
});
