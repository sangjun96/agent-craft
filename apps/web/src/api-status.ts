import { useEffect, useState } from "react";

export type ApiStatus =
  | { state: "connecting" }
  | { state: "ok"; message: string }
  | { state: "failed"; error: string };

export function useApiStatus(): ApiStatus {
  const [status, setStatus] = useState<ApiStatus>({ state: "connecting" });

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/hello", { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        setStatus({ state: "ok", message: await response.text() });
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) setStatus({ state: "failed", error: String(error) });
      });
    return () => controller.abort();
  }, []);

  return status;
}
