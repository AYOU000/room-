import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import type { StatusTone } from "../components/StatusDot";
import { API_URL } from "./config";

export type ApiStatus = "idle" | "checking" | "online" | "offline";

export const apiStatusTone: Record<ApiStatus, StatusTone> = {
  idle: "idle",
  checking: "checking",
  online: "live",
  offline: "offline",
};

type ApiHealth = {
  status: ApiStatus;
  recheck: () => Promise<void>;
};

const ApiHealthContext = createContext<ApiHealth | null>(null);

function isHealthy(data: unknown): boolean {
  return typeof data === "object" && data !== null && (data as { status?: unknown }).status === "ok";
}

export function ApiHealthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<ApiStatus>("idle");
  const latestRequest = useRef(0);

  const recheck = useCallback(async () => {
    const request = ++latestRequest.current;
    setStatus("checking");

    let next: ApiStatus = "offline";
    try {
      const response = await fetch(`${API_URL}/health`);
      if (response.ok && isHealthy(await response.json())) next = "online";
    } catch {
      // Network failure: keep "offline".
    }

    // Ignore results from an older check that finished late.
    if (request === latestRequest.current) setStatus(next);
  }, []);

  useEffect(() => {
    void recheck();
  }, [recheck]);

  return <ApiHealthContext value={{ status, recheck }}>{children}</ApiHealthContext>;
}

export function useApiHealth(): ApiHealth {
  const value = useContext(ApiHealthContext);
  if (!value) throw new Error("useApiHealth must be used inside ApiHealthProvider");
  return value;
}
