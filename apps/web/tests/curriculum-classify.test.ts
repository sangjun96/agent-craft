import type { Answer } from "ai-services/system-one";
import { expect, test } from "vite-plus/test";
import {
  classifyQuestion,
  selectBranches,
  type Decide,
} from "../worker/agents/curriculum/classify.ts";
import { buildTree } from "../worker/agents/curriculum/tree.ts";
import { runUsage } from "../worker/agents/curriculum/usage.ts";
import type { Step } from "../worker/agents/types.ts";

const image = { type: "image_url", image_url: { url: "data:image/png;base64,AAAA" } } as const;
const options = (probabilities: Record<string, number>) =>
  Object.entries(probabilities).map(([name, probability]) => ({ name, probability }));

test("selectBranches follows only the best option when it reaches the threshold", () => {
  expect(selectBranches(options({ a: 0.8, b: 0.15, c: 0.05 }))).toEqual(["a"]);
  expect(selectBranches(options({ a: 0.3, b: 0.7 }))).toEqual(["b"]);
});

test("selectBranches explores the top two options when none is confident", () => {
  expect(selectBranches(options({ a: 0.3, b: 0.5, c: 0.2 }))).toEqual(["b", "a"]);
  expect(selectBranches(options({ a: 0.69, b: 0.31 }))).toEqual(["a", "b"]);
  expect(selectBranches(options({ a: 1 }))).toEqual(["a"]);
});

// Every level has the same two children, named after their level, so any path is valid.
const wideTree = () => {
  const rows: string[][] = [];
  for (const a of ["a1", "a2"])
    for (const b of ["b1", "b2"])
      for (const c of ["c1", "c2"])
        for (const d of ["d1", "d2"]) for (const e of ["e1", "e2"]) rows.push([a, b, c, d, e]);
  return buildTree(rows);
};

/** Answers every choice with the given probabilities for its first and second option. */
const answering = (first: number, second: number, usage?: Step["usage"]) => {
  let calls = 0;
  const decide: Decide = async (_state, questions) => {
    calls++;
    const question = questions.choice!;
    if (question.type !== "choice") throw new Error("expected a choice");
    const [one, two] = Object.keys(question.criteria);
    const answer: Answer = {
      type: "choice",
      choice: one!,
      probabilities: { [one!]: first, [two!]: second },
    };
    return { answers: { choice: answer }, usage };
  };
  return { decide, calls: () => calls };
};

test("classifyQuestion keeps at most two branches per level and picks the highest cumulative probability", async () => {
  const { decide, calls } = answering(0.55, 0.45);
  const steps = new Map<string, Step>();

  const result = await classifyQuestion({
    tree: wideTree(),
    number: "3",
    image,
    decide,
    onStep: (step) => steps.set(step.id, step),
  });

  expect(result.path).toEqual(["a1", "b1", "c1", "d1", "e1"]);
  expect(result.score).toBeCloseTo(0.55 ** 5);
  // One call at level 0, then two live paths per level: 1 + 2 * 4.
  expect(calls()).toBe(9);
  for (let level = 0; level < 5; level++) {
    const picked = [...steps.values()].filter((s) => s.level === level).flatMap((s) => s.picked);
    expect(picked.length).toBeLessThanOrEqual(2);
  }
});

test("classifyQuestion reports usage per step", async () => {
  const usage = { inputTokens: 100, outputTokens: 10, cost: 0.01 };
  const { decide } = answering(0.9, 0.1, usage);
  const steps = new Map<string, Step>();

  const result = await classifyQuestion({
    tree: wideTree(),
    number: "1",
    image,
    decide,
    onStep: (step) => steps.set(step.id, step),
  });

  expect(result.score).toBeCloseTo(0.9 ** 5);
  expect(steps.size).toBe(5);
  const run = {
    extract: { status: "done" as const },
    questions: [{ number: "1", status: "done" as const, steps: [...steps.values()] }],
  };
  expect(runUsage(run)).toEqual({ inputTokens: 500, outputTokens: 50, cost: 0.05 });
});

test("classifyQuestion skips the model when a level has a single option", async () => {
  const tree = buildTree([["a", "b", "c", "d", "e"]]);
  const { decide, calls } = answering(0.5, 0.5);
  const steps: Step[] = [];

  const result = await classifyQuestion({
    tree,
    number: "1",
    image,
    decide,
    onStep: (step) => steps.push(step),
  });

  expect(calls()).toBe(0);
  expect(result).toEqual({ path: ["a", "b", "c", "d", "e"], score: 1 });
  expect(steps.every((step) => step.auto)).toBe(true);
});

test("classifyQuestion takes only the best option at each level when Jev is confident", async () => {
  const { decide, calls } = answering(0.9, 0.1);

  const result = await classifyQuestion({
    tree: wideTree(),
    number: "1",
    image,
    decide,
    onStep: () => {},
  });

  expect(result.path).toEqual(["a1", "b1", "c1", "d1", "e1"]);
  expect(calls()).toBe(5);
});

test("classifyQuestion switches to the runner-up when its path ends with the higher cumulative probability", async () => {
  // Unsure at level 0 (a1 0.6, a2 0.4); a2's subtree is then answered with certainty while a1's stays unsure.
  const decide: Decide = async (_state, questions) => {
    const question = questions.choice!;
    if (question.type !== "choice") throw new Error("expected a choice");
    const [one, two] = Object.keys(question.criteria);
    const underA2 =
      typeof question.instructions === "string" && question.instructions.includes("상위 분류: a2");
    const probabilities = underA2 ? { [one!]: 1, [two!]: 0 } : { [one!]: 0.6, [two!]: 0.4 };
    const answer: Answer = { type: "choice", choice: one!, probabilities };
    return { answers: { choice: answer } };
  };

  const result = await classifyQuestion({
    tree: wideTree(),
    number: "1",
    image,
    decide,
    onStep: () => {},
  });

  expect(result.path).toEqual(["a2", "b1", "c1", "d1", "e1"]);
  expect(result.score).toBeCloseTo(0.4);
});

test("classifyQuestion marks the step failed and rethrows when the model call fails", async () => {
  const steps: Step[] = [];
  const decide: Decide = async () => {
    throw new Error("boom");
  };

  await expect(
    classifyQuestion({
      tree: wideTree(),
      number: "1",
      image,
      decide,
      onStep: (s) => steps.push(s),
    }),
  ).rejects.toThrow("boom");
  expect(steps.at(-1)).toMatchObject({ status: "error", error: "boom" });
});
