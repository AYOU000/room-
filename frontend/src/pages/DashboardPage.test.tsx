import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderRoute } from "../test/render";

describe("DashboardPage", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ status: "ok" }))));
  });

  it("shows stats, both room actions and recent debates", () => {
    renderRoute("/dashboard");

    expect(screen.getByRole("heading", { level: 1, name: /welcome back/i })).toBeInTheDocument();
    expect(screen.getByText("SAMPLE DATA")).toBeInTheDocument();

    const stats = screen.getByRole("region", { name: /your stats/i });
    expect(within(stats).getByText("Debates")).toBeInTheDocument();
    expect(within(stats).getByText("Average score")).toBeInTheDocument();

    expect(screen.getByRole("heading", { name: /start a debate/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /join a debate/i })).toBeInTheDocument();

    const recent = screen.getByRole("region", { name: /recent debates/i });
    expect(within(recent).getAllByRole("listitem")).toHaveLength(5);
    expect(within(recent).getByText("Tie")).toBeInTheDocument();
    expect(within(recent).getAllByText("No evaluation")).toHaveLength(2);
    expect(within(recent).getByText("Interrupted")).toBeInTheDocument();
  });

  it("validates the topic, then shows the invite code", async () => {
    const user = userEvent.setup();
    renderRoute("/dashboard");

    await user.click(screen.getByRole("button", { name: /create room/i }));
    expect(screen.getByLabelText("Topic")).toHaveAccessibleDescription("Write at least 5 characters.");

    await user.type(screen.getByLabelText("Topic"), "Remote work is better");
    await user.click(screen.getByRole("button", { name: /create room/i }));

    expect(await screen.findByRole("heading", { name: /your room is ready/i })).toBeInTheDocument();
    expect(screen.getByText("QX7M-4KD2-PL9A")).toBeInTheDocument();
  });

  it("renders a topic containing markup as plain text", async () => {
    const user = userEvent.setup();
    renderRoute("/dashboard");

    const payload = "<img src=x onerror=alert(1)>";
    await user.type(screen.getByLabelText("Topic"), payload);
    expect(screen.getByLabelText("Topic")).toHaveValue(payload);
    expect(document.querySelector("img")).toBeNull();
  });

  it("explains join failures", async () => {
    const user = userEvent.setup();
    renderRoute("/dashboard");

    await user.click(screen.getByRole("button", { name: /join room/i }));
    expect(screen.getByLabelText("Invite code")).toHaveAccessibleDescription(/enter the invite code/i);

    await user.type(screen.getByLabelText("Invite code"), "expired");
    await user.click(screen.getByRole("button", { name: /join room/i }));
    expect(await screen.findByText(/this invite has expired/i)).toBeInTheDocument();
  });

  it("is reachable from the top bar", () => {
    renderRoute("/");
    expect(screen.getByRole("link", { name: /dashboard/i })).toHaveAttribute("href", "/dashboard");
  });
});
