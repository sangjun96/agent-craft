import { expect, test, vi } from "vite-plus/test";
import { createLlm } from "../src/llm.ts";

const send = vi.fn();

vi.mock("@openrouter/sdk", () => ({
  OpenRouter: class {
    chat = { send };
  },
}));

test("chat maps request and response", async () => {
  send.mockResolvedValue({
    model: "openai/gpt-5",
    choices: [{ message: { role: "assistant", content: "Hi!" } }],
    usage: { promptTokens: 3, completionTokens: 2 },
  });

  const result = await createLlm({ apiKey: "key" }).chat({
    model: "openai/gpt-5",
    messages: [{ role: "user", content: "Hello" }],
    maxTokens: 100,
  });

  expect(send).toHaveBeenCalledWith({
    chatRequest: {
      model: "openai/gpt-5",
      messages: [{ role: "user", content: "Hello" }],
      temperature: undefined,
      maxTokens: 100,
      stream: false,
    },
  });
  expect(result).toEqual({
    text: "Hi!",
    model: "openai/gpt-5",
    usage: { inputTokens: 3, outputTokens: 2 },
  });
});

test("chat joins text parts when content is an array", async () => {
  send.mockResolvedValue({
    model: "m",
    choices: [
      {
        message: {
          role: "assistant",
          content: [
            { type: "text", text: "a" },
            { type: "text", text: "b" },
          ],
        },
      },
    ],
  });

  const result = await createLlm({ apiKey: "key" }).chat({ model: "m", messages: [] });

  expect(result.text).toBe("ab");
});
