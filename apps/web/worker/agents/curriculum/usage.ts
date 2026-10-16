import type { CurriculumRun, QuestionTrace, Usage } from "../types.ts";

export function sumUsage(usages: (Usage | undefined)[]): Usage {
  const total: Usage = { inputTokens: 0, outputTokens: 0, cost: 0 };
  for (const usage of usages) {
    if (!usage) continue;
    total.inputTokens += usage.inputTokens;
    total.outputTokens += usage.outputTokens;
    total.cost += usage.cost;
  }
  return total;
}

export function questionUsage(question: QuestionTrace): Usage {
  return sumUsage(question.steps.map((step) => step.usage));
}

/** The general LLM's share: extracting the question numbers. */
export function llmUsage(run: Pick<CurriculumRun, "extract">): Usage {
  return sumUsage([run.extract.usage]);
}

/** Jev's share: every classification step of every question. */
export function jevUsage(run: Pick<CurriculumRun, "questions">): Usage {
  return sumUsage(run.questions.map(questionUsage));
}

/** Jev requests made so far; automatic steps ask nothing. */
export function jevCalls(run: Pick<CurriculumRun, "questions">): number {
  return run.questions.reduce(
    (count, question) => count + question.steps.filter((step) => step.usage).length,
    0,
  );
}

/** Extraction plus every classification step of every question. */
export function runUsage(run: Pick<CurriculumRun, "extract" | "questions">): Usage {
  return sumUsage([llmUsage(run), jevUsage(run)]);
}
