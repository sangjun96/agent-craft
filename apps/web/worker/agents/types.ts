// Plain types shared by the worker and the web app; keep this file free of runtime imports.
import type { BoxAnswer } from "ai-services/system-one";

export type RunStatus = "running" | "done" | "error";

export type Usage = { inputTokens: number; outputTokens: number; cost: number };

export type RunSummary = {
  id: string;
  status: RunStatus;
  /** One-line description of the run's input, shown in run lists. */
  label: string;
  createdAt: number;
  finishedAt?: number;
  usage?: Usage;
  error?: string;
};

/** Synced state every dashboard agent exposes, so one card component can show any of them. */
export type AgentStatusState = {
  status: "idle" | RunStatus;
  step?: string;
  /** 0–1 progress of the current run. */
  progress: number;
  usage: Usage & { runs: number };
  recentRuns: RunSummary[];
};

export type BboxResult = {
  /** Probability that the target is in the image. */
  present?: number;
  box?: BoxAnswer["box"];
  confidence?: number;
};

export type BboxRun = RunSummary & { target: string; image: string; result?: BboxResult };
