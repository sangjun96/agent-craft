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
