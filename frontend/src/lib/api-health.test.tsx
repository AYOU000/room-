import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ApiHealthProvider, useApiHealth } from "./api-health";

function Probe() {
  const { status, recheck } = useApiHealth();
  return (
    <>
      <output>{status}</output>
      <button type="button" onClick={() => void recheck()}>
        recheck
      </button>
    </>
  );
}

function renderProbe() {
  return render(
    <ApiHealthProvider>
      <Probe />
    </ApiHealthProvider>,
  );
}

describe("ApiHealthProvider", () => {
  it("reports online when /health returns status ok", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ status: "ok" })));
    vi.stubGlobal("fetch", fetchMock);

    renderProbe();

    expect(await screen.findByText("online")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(expect.stringMatching(/\/health$/));
  });

  it("reports offline for a non-ok body, an HTTP error or a network failure", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ status: "degraded" })))
      .mockResolvedValueOnce(new Response("nope", { status: 500 }))
      .mockRejectedValueOnce(new TypeError("Failed to fetch"));
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();

    renderProbe();
    expect(await screen.findByText("offline")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "recheck" }));
    expect(await screen.findByText("offline")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "recheck" }));
    expect(await screen.findByText("offline")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("ignores a slow earlier response that resolves after a newer one", async () => {
    let resolveSlow: (response: Response) => void = () => {};
    const fetchMock = vi
      .fn()
      .mockReturnValueOnce(new Promise<Response>((resolve) => (resolveSlow = resolve)))
      .mockResolvedValueOnce(new Response(JSON.stringify({ status: "ok" })));
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();

    renderProbe();
    await user.click(screen.getByRole("button", { name: "recheck" }));
    expect(await screen.findByText("online")).toBeInTheDocument();

    resolveSlow(new Response("down", { status: 503 }));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(screen.getByText("online")).toBeInTheDocument();
  });
});
