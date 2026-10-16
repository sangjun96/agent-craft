import { useEffect, useState } from "react";
import type { CurriculumRun } from "../../../worker/agents/types.ts";
import type { DashboardAgent } from "../use-dashboard-agent.ts";

/** The live run straight from the agent's synced state; any other run is loaded from its history. */
export function useCurriculumRun(agent: DashboardAgent, runId: string): CurriculumRun | undefined {
  const { call } = agent;
  const live = agent.state?.live;
  const [loaded, setLoaded] = useState<CurriculumRun | null>(null);
  const isLive = live?.id === runId;

  useEffect(() => {
    if (isLive) return;
    let cancelled = false;
    call<CurriculumRun | null>("getRun", [runId]).then(
      (result) => !cancelled && setLoaded(result),
      () => !cancelled && setLoaded(null),
    );
    return () => {
      cancelled = true;
    };
  }, [call, runId, isLive]);

  if (isLive) return live;
  return loaded?.id === runId ? loaded : undefined;
}

/** Re-renders while `active`, so elapsed time keeps ticking. */
export function useNow(active: boolean): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const timer = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(timer);
  }, [active]);
  return now;
}
