import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vite-plus/test";
import { ClassificationList } from "./classification-list.tsx";
import { finishedRun } from "./fixtures.ts";

test("ClassificationList nests the chosen path from 대단원 to 세부유형 with each probability", () => {
  const html = renderToStaticMarkup(<ClassificationList run={finishedRun} />);

  expect(html).toContain("1번");
  expect(html).toContain("종합 40%");
  const order = [
    "대단원",
    "수와 연산",
    "55%",
    "중단원",
    "소인수분해",
    "세부 유형",
    "약수 구하기",
  ].map((text) => html.indexOf(text));
  expect(order.every((index) => index >= 0)).toBe(true);
  expect(order).toEqual([...order].sort((a, b) => a - b));
  // Nested lists, one per level: the question's own list plus five levels.
  expect(html.match(/<ul/g)).toHaveLength(6);
});

test("ClassificationList reports questions still being classified and failed ones", () => {
  const run = {
    ...finishedRun,
    questions: [
      { number: "1", status: "running" as const, steps: [] },
      { number: "2", status: "error" as const, steps: [], error: "boom" },
    ],
  };

  const html = renderToStaticMarkup(<ClassificationList run={run} />);

  expect(html).toContain("분류 중…");
  expect(html).toContain("boom");
});
