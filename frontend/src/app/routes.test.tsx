import { screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderRoute } from "../test/render";

describe("routes", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ status: "ok" }))));
  });

  it("renders the home page inside the shell", async () => {
    renderRoute("/");

    expect(screen.getByRole("heading", { level: 1, name: /good ideas\s*deserve a challenge/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /room home/i })).toHaveAttribute("href", "/");
    expect(screen.getByRole("contentinfo")).toHaveTextContent("Made for thoughtful disagreement.");
    expect(await screen.findByText("Systems operational")).toBeInTheDocument();
  });

  it("renders a not-found page for unknown paths", () => {
    renderRoute("/does-not-exist");

    expect(screen.getByRole("heading", { name: /this room doesn't exist/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /back to home/i })).toHaveAttribute("href", "/");
  });
});
