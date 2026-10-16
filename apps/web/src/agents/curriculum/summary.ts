import {
  decisionCalls,
  decisionUsage,
  llmUsage,
  runUsage,
} from "../../../worker/agents/curriculum/usage.ts";
import type { CurriculumRun, Usage } from "../../../worker/agents/types.ts";

export type Part = { usage: Usage; durationMs: number | undefined };

/** Cost and time of the general LLM (extraction) and of Decision (classification), apart and together. */
export type RunSummary = { llm: Part; decision: Part & { calls: number }; total: Part };

/**
 * Extraction runs first and classification afterwards, so Decision's time is the wall-clock time left once
 * extraction is done; its requests run in parallel, which makes that shorter than their durations added up.
 */
export function summarizeRun(run: CurriculumRun, now: number): RunSummary {
  const elapsed = Math.max(0, (run.finishedAt ?? now) - run.createdAt);
  const extractMs = run.extract.durationMs;
  return {
    llm: { usage: llmUsage(run), durationMs: extractMs },
    decision: {
      usage: decisionUsage(run),
      durationMs: extractMs === undefined ? undefined : Math.max(0, elapsed - extractMs),
      calls: decisionCalls(run),
    },
    total: { usage: runUsage(run), durationMs: elapsed },
  };
}
