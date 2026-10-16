import type { Answer, ImagePart, Question } from "ai-services/system-one";
import type { Step, StepOption, Usage } from "../types.ts";
import { CONFIDENCE_THRESHOLD, LEVELS, MAX_BRANCHES } from "./constants.ts";
import type { CurriculumNode } from "./tree.ts";

export type Decide = (
  state: [string, ImagePart],
  questions: Record<string, Question>,
) => Promise<{ answers: Record<string, Answer>; usage?: Usage }>;

type BeamItem = { node: CurriculumNode; path: string[]; score: number };

/** The best option alone when it reaches the threshold; otherwise the best MAX_BRANCHES options, as Jev is unsure. */
export function selectBranches(options: StepOption[]): string[] {
  const ranked = options
    .map(({ name, probability }) => ({ name, probability: probability ?? 0 }))
    .sort((a, b) => b.probability - a.probability);
  const confident = (ranked[0]?.probability ?? 0) >= CONFIDENCE_THRESHOLD;
  return ranked.slice(0, confident ? 1 : MAX_BRANCHES).map(({ name }) => name);
}

/**
 * Walks the curriculum for one question level by level, keeping the MAX_BRANCHES paths with the highest
 * cumulative probability. `onStep` fires every time a step is created or changes.
 */
export async function classifyQuestion(params: {
  tree: CurriculumNode;
  number: string;
  image: ImagePart;
  decide: Decide;
  onStep: (step: Step) => void;
}): Promise<{ path: string[]; score: number }> {
  const { tree, number, image, decide, onStep } = params;
  let beam: BeamItem[] = [{ node: tree, path: [], score: 1 }];

  for (let level = 0; level < LEVELS.length; level++) {
    const asked = await Promise.all(
      beam.map(async (item) => {
        const step = await ask({ item, level, number, image, decide, onStep });
        const byName = new Map(
          step.options.map((option) => [option.name, option.probability ?? 0]),
        );
        const branches = selectBranches(step.options).map((name) => ({
          node: item.node.children.find((child) => child.name === name)!,
          path: [...item.path, name],
          score: item.score * byName.get(name)!,
        }));
        return { step, branches };
      }),
    );

    const kept = asked
      .flatMap(({ step, branches }) => branches.map((branch) => ({ step, branch })))
      .sort((a, b) => b.branch.score - a.branch.score)
      .slice(0, MAX_BRANCHES);
    // Report the pruning, so a step shows only the options that continue.
    for (const { step } of asked) {
      step.picked = kept.filter((k) => k.step === step).map((k) => k.branch.path[level]!);
      onStep({ ...step });
    }
    beam = kept.map(({ branch }) => branch);
  }

  const best = beam[0]!;
  return { path: best.path, score: best.score };
}

async function ask(params: {
  item: BeamItem;
  level: number;
  number: string;
  image: ImagePart;
  decide: Decide;
  onStep: (step: Step) => void;
}): Promise<Step> {
  const { item, level, number, image, decide, onStep } = params;
  const names = item.node.children.map((child) => child.name);
  const step: Step = {
    id: JSON.stringify(item.path),
    level,
    path: item.path,
    status: "running",
    options: names.map((name) => ({ name })),
    picked: [],
  };

  if (names.length === 1) {
    // A choice needs something to choose between.
    step.status = "done";
    step.auto = true;
    step.options = [{ name: names[0]!, probability: 1 }];
    step.picked = [names[0]!];
    onStep({ ...step });
    return step;
  }

  onStep({ ...step });
  const startedAt = Date.now();
  try {
    const { answers, usage } = await decide(
      [`시험지 이미지입니다. ${number}번 문항을 분류합니다.`, image],
      {
        choice: {
          type: "choice",
          instructions: [
            `${number}번 문항에 해당하는 ${LEVELS[level]}을(를) 고르세요.`,
            item.path.length > 0 ? `상위 분류: ${item.path.join(" > ")}` : "",
          ]
            .filter(Boolean)
            .join(" "),
          criteria: Object.fromEntries(names.map((name) => [name, null])),
        },
      },
    );
    const answer = answers.choice;
    if (answer?.type !== "choice") throw new Error("Jev가 choice 답변을 반환하지 않았습니다");

    const probabilities = answer.probabilities ?? { [answer.choice]: answer.confidence ?? 1 };
    step.options = names.map((name) => ({ name, probability: probabilities[name] ?? 0 }));
    step.picked = selectBranches(step.options);
    step.status = "done";
    step.usage = usage;
    step.durationMs = Date.now() - startedAt;
    onStep({ ...step });
    return step;
  } catch (error) {
    step.status = "error";
    step.durationMs = Date.now() - startedAt;
    step.error = error instanceof Error ? error.message : String(error);
    onStep({ ...step });
    throw error;
  }
}
