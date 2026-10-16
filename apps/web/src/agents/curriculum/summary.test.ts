import { expect, test } from "vite-plus/test";
import type { CurriculumRun } from "../../../worker/agents/types.ts";
import { finishedRun } from "./fixtures.ts";
import { summarizeRun } from "./summary.ts";

test("summarizeRun keeps the general LLM's and Decision's cost and time apart", () => {
  const { llm, decision, total } = summarizeRun(finishedRun, 0);

  expect(llm).toEqual({
    usage: { inputTokens: 100, outputTokens: 10, cost: 0.001 },
    durationMs: 800,
  });
  // All six steps of the fixture asked Decision.
  expect(decision.calls).toBe(6);
  expect(decision.usage.cost).toBeCloseTo(0.006);
  // Run took 4000ms and extraction 800ms of it.
  expect(decision.durationMs).toBe(3200);
  expect(total.durationMs).toBe(4000);
  expect(total.usage.cost).toBeCloseTo(llm.usage.cost + decision.usage.cost);
});

test("summarizeRun counts elapsed time up to now while running and has no Decision time before extraction ends", () => {
  const running: CurriculumRun = {
    ...finishedRun,
    status: "running",
    finishedAt: undefined,
    extract: { status: "running" },
    questions: [],
  };

  const { llm, decision, total } = summarizeRun(running, 1500);

  expect(llm.usage.cost).toBe(0);
  expect(decision).toMatchObject({ calls: 0, durationMs: undefined });
  expect(total.durationMs).toBe(1500);
});
