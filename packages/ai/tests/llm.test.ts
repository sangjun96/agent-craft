import { expect, test, vi } from "vite-plus/test";
import * as z from "zod";
import { createLlm } from "../src/llm.ts";

const send = vi.fn();

vi.mock("@openrouter/sdk", () => ({
  OpenRouter: class {
    chat = { send };
  },
}));

const schema = z.object({ title: z.string(), tags: z.array(z.string()) });

test("generateObject sends the schema and returns the parsed object", async () => {
  send.mockResolvedValue({
    choices: [{ message: { role: "assistant", content: '{"title":"Hi","tags":["a"]}' } }],
  });

  const result = await createLlm({ apiKey: "key" }).generateObject("Make a post", schema);

  expect(send).toHaveBeenCalledWith({
    chatRequest: {
      model: "google/gemini-3.8-flash",
      messages: [{ role: "user", content: "Make a post" }],
      reasoning: { effort: "medium" },
      responseFormat: {
        type: "json_schema",
        jsonSchema: { name: "output", schema: z.toJSONSchema(schema), strict: true },
      },
      stream: false,
    },
  });
  expect(result).toEqual({ title: "Hi", tags: ["a"] });
});

test("generateObject rejects output that does not match the schema", async () => {
  send.mockResolvedValue({
    choices: [{ message: { role: "assistant", content: '{"title":1}' } }],
  });

  await expect(createLlm({ apiKey: "key" }).generateObject("x", schema)).rejects.toThrow(
    z.ZodError,
  );
});

test("generateObject passes content parts such as images through as the user message", async () => {
  send.mockResolvedValue({
    choices: [{ message: { role: "assistant", content: '{"title":"Cup","tags":[]}' } }],
  });
  const content = [
    { type: "text" as const, text: "Name this image" },
    { type: "image_url" as const, imageUrl: { url: "data:image/png;base64,iVBORw0KGgo=" } },
  ];

  await createLlm({ apiKey: "key" }).generateObject(content, schema);

  expect(send.mock.lastCall?.[0].chatRequest.messages).toEqual([{ role: "user", content }]);
});

test("generateObject reports usage through onUsage", async () => {
  send.mockResolvedValue({
    choices: [{ message: { role: "assistant", content: '{"title":"Hi","tags":[]}' } }],
    usage: { promptTokens: 900, completionTokens: 30, cost: 0.0002 },
  });
  const onUsage = vi.fn();

  await createLlm({ apiKey: "key", onUsage }).generateObject("x", schema);

  expect(onUsage).toHaveBeenCalledWith({ inputTokens: 900, outputTokens: 30, cost: 0.0002 });
});

test("generateObject adds the provider's charge to the cost when the key is BYOK", async () => {
  send.mockResolvedValue({
    choices: [{ message: { role: "assistant", content: '{"title":"Hi","tags":[]}' } }],
    usage: {
      promptTokens: 3,
      completionTokens: 100,
      cost: 0,
      isByok: true,
      costDetails: { upstreamInferenceCost: 0.00075 },
    },
  });
  const onUsage = vi.fn();

  await createLlm({ apiKey: "key", onUsage }).generateObject("x", schema);

  expect(onUsage).toHaveBeenCalledWith({ inputTokens: 3, outputTokens: 100, cost: 0.00075 });
});
