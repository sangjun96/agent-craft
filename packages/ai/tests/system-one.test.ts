import { expect, test, vi } from "vite-plus/test";
import { createSystemOne } from "../src/system-one.ts";

const create = vi.fn();

vi.mock("@openrouter/sdk", () => ({
  OpenRouter: class {
    systemOne = { create };
  },
}));

test("decide sends state and questions to jev-latest and returns the answers", async () => {
  const answers = { spam: { type: "noul", noul: 0.1 } };
  create.mockResolvedValue({
    answers,
    model: "jev-1.13",
    usage: { inputTokens: 10, outputTokens: 1 },
  });

  const questions = { spam: { type: "noul", instructions: "Is this message spam?" } } as const;
  const result = await createSystemOne({ apiKey: "key" }).decide("Buy now!!!", questions);

  expect(create).toHaveBeenCalledWith({
    decisionsRequest: { model: "jev-latest", state: "Buy now!!!", questions },
  });
  expect(result).toEqual(answers);
});
