import type { QuestionTrace } from "../../../worker/agents/types.ts";

export type PathLevel = { level: number; name: string; probability: number };

/** The final path of a question as one entry per level, each with the probability it was chosen at. */
export function finalLevels(question: QuestionTrace): PathLevel[] {
  const path = question.final?.path ?? [];
  return path.map((name, level) => {
    const step = question.steps.find(
      (s) => JSON.stringify(s.path) === JSON.stringify(path.slice(0, level)),
    );
    return {
      level,
      name,
      probability: step?.options.find((o) => o.name === name)?.probability ?? 0,
    };
  });
}
