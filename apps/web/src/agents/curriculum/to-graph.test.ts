import { expect, test } from "vite-plus/test";
import type { CurriculumRun } from "../../../worker/agents/types.ts";
import { finishedRun } from "./fixtures.ts";
import { buildGraph } from "./to-graph.ts";

const byTitle = (nodes: ReturnType<typeof buildGraph>["nodes"], title: string) =>
  nodes.find((node) => node.data.title === title)!;

test("buildGraph shows the options that were followed and hides the ones left out", () => {
  const { nodes, edges } = buildGraph(finishedRun);

  expect(byTitle(nodes, "수와 연산").data).toMatchObject({
    state: "final",
    probability: 0.55,
    level: "대단원",
  });
  expect(byTitle(nodes, "약수 구하기").data.state).toBe("final");
  // 문자와 식 was explored as a runner-up but is not on the final path.
  expect(byTitle(nodes, "문자와 식").data.state).toBe("picked");
  // 일차방정식 was offered under 문자와 식 but not followed, so it is not drawn.
  expect(nodes.find((node) => node.data.title === "일차방정식")).toBeUndefined();
  expect(byTitle(nodes, "1번").data).toMatchObject({ kind: "question", state: "final" });
  expect(byTitle(nodes, "1번").data.meta).toBe("$0.006000 · 3.0초");
  // Root, the question and 2 + 1 + 1 + 1 + 1 options, each linked to its parent.
  expect(nodes).toHaveLength(8);
  expect(edges).toHaveLength(nodes.length - 1);
});

test("buildGraph lays levels out in columns", () => {
  const { nodes } = buildGraph(finishedRun);

  const xs = ["시험지", "1번", "수와 연산", "소인수분해", "약수", "기본", "약수 구하기"].map(
    (title) => byTitle(nodes, title).position.x,
  );
  expect(xs).toEqual([...xs].sort((a, b) => a - b));
  expect(new Set(xs).size).toBe(xs.length);
});

test("buildGraph shows offered options as pending while Jev has not answered", () => {
  const running: CurriculumRun = {
    ...finishedRun,
    status: "running",
    finishedAt: undefined,
    questions: [
      {
        number: "1",
        status: "running",
        steps: [
          {
            id: "[]",
            level: 0,
            path: [],
            status: "running",
            options: [{ name: "수와 연산" }, { name: "문자와 식" }],
            picked: [],
          },
        ],
      },
    ],
  };

  const { nodes, edges } = buildGraph(running);

  expect(byTitle(nodes, "수와 연산").data).toMatchObject({
    state: "pending",
    probability: undefined,
  });
  expect(byTitle(nodes, "1번").data).toMatchObject({ state: "pending", meta: "분류 중…" });
  expect(edges.filter((edge) => edge.animated)).toHaveLength(2);
});

test("buildGraph with no questions yet is a lone root node", () => {
  const { nodes, edges } = buildGraph({
    ...finishedRun,
    status: "running",
    extract: { status: "running" },
    questions: [],
  });

  expect(nodes.map((node) => node.data.meta)).toEqual(["문항 추출 중…"]);
  expect(edges).toEqual([]);
});
