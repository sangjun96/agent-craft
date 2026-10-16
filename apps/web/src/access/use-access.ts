import { hc } from "hono/client";
import useSWR from "swr";
import type { api } from "../../worker/api.ts";

const client = hc<typeof api>("/api").access;

export async function fetchAccess(): Promise<boolean> {
  const response = await client.$get();
  if (!response.ok) return false;
  const { authenticated } = await response.json();
  return authenticated;
}

/** Whether the current viewer passed Cloudflare Access and may trigger runs or mutate resources. */
export function useAccess(): { canEdit: boolean } {
  const { data } = useSWR("/api/access", fetchAccess);
  return { canEdit: data ?? false };
}
