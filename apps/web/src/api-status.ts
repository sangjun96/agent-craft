import useSWR from "swr";

export type ApiStatus =
  | { state: "connecting" }
  | { state: "ok"; message: string }
  | { state: "failed"; error: string };

async function fetchHello(url: string): Promise<string> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.text();
}

export function useApiStatus(): ApiStatus {
  const { data, error } = useSWR("/api/hello", fetchHello);
  if (data !== undefined) return { state: "ok", message: data };
  if (error) return { state: "failed", error: String(error) };
  return { state: "connecting" };
}
