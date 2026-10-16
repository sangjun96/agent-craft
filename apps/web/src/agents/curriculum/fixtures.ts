import type { CurriculumRun, Step } from "../../../worker/agents/types.ts";

const usage = { inputTokens: 100, outputTokens: 10, cost: 0.001 };

const step = (path: string[], options: Step["options"], picked: string[]): Step => ({
  id: JSON.stringify(path),
  level: path.length,
  path,
  status: "done",
  options,
  picked,
  usage,
  durationMs: 500,
});

/** Question 1 is unsure at the first level, so both 대단원 branches were opened; 수와 연산 won. */
export const finishedRun: CurriculumRun = {
  id: "run",
  status: "done",
  label: "1개 문항",
  createdAt: 0,
  finishedAt: 4000,
  extract: { status: "done", usage, durationMs: 800 },
  questions: [
    {
      number: "1",
      status: "done",
      durationMs: 3000,
      final: { path: ["수와 연산", "소인수분해", "약수", "기본", "약수 구하기"], score: 0.4 },
      steps: [
        step(
          [],
          [
            { name: "수와 연산", probability: 0.55 },
            { name: "문자와 식", probability: 0.45 },
          ],
          ["수와 연산", "문자와 식"],
        ),
        step(["수와 연산"], [{ name: "소인수분해", probability: 0.9 }], ["소인수분해"]),
        step(["수와 연산", "소인수분해"], [{ name: "약수", probability: 1 }], ["약수"]),
        step(["수와 연산", "소인수분해", "약수"], [{ name: "기본", probability: 1 }], ["기본"]),
        step(
          ["수와 연산", "소인수분해", "약수", "기본"],
          [{ name: "약수 구하기", probability: 1 }],
          ["약수 구하기"],
        ),
        step(["문자와 식"], [{ name: "일차방정식", probability: 1 }], []),
      ],
    },
  ],
};
