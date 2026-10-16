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
  /** The run in progress, for agents that stream a live view of it. */
  live?: CurriculumRun;
};

export type BboxResult = {
  /** Probability that the target is in the image. */
  present?: number;
  box?: BoxAnswer["box"];
  confidence?: number;
};

export type BboxRun = RunSummary & { target: string; image: string; result?: BboxResult };

/** One option of a curriculum choice; the probability is unknown until Jev has answered. */
export type StepOption = { name: string; probability?: number };

/** One choice question about a curriculum level, or an automatic step when only one option exists. */
export type Step = {
  /** Unique within its question. */
  id: string;
  /** Index into LEVELS. */
  level: number;
  /** Names chosen on the way here; as many as the step's level. */
  path: string[];
  status: "running" | "done" | "error";
  auto?: boolean;
  options: StepOption[];
  /** Options that stayed in the beam once the whole level was compared by cumulative probability. */
  picked: string[];
  usage?: Usage;
  durationMs?: number;
  error?: string;
};

export type QuestionTrace = {
  /** Question number as printed on the exam. */
  number: string;
  status: RunStatus;
  steps: Step[];
  /** The best full path once every level is answered. */
  final?: { path: string[]; score: number };
  durationMs?: number;
  error?: string;
};

export type CurriculumRun = RunSummary & {
  /** Extracting the question numbers from the image. */
  extract: { status: RunStatus; usage?: Usage; durationMs?: number };
  questions: QuestionTrace[];
};
