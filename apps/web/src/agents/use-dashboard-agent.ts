import { useAgent } from "agents/react";
import type { AgentStatusState } from "../../worker/agents/types.ts";

/** Every dashboard agent runs as a single "default" instance per class. */
export function useDashboardAgent(slug: string) {
  return useAgent<AgentStatusState>({ agent: slug, name: "default" });
}

export type DashboardAgent = ReturnType<typeof useDashboardAgent>;
