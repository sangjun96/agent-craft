import { OpenRouter } from "@openrouter/sdk";
import type { ChatResult } from "@openrouter/sdk/models";
import * as z from "zod";

const MODEL = "google/gemini-3.8-flash";

export function createLlm(options: { apiKey: string }) {
  const client = new OpenRouter({ apiKey: options.apiKey });

  return {
    async generateObject<T extends z.ZodType>(prompt: string, schema: T): Promise<z.infer<T>> {
      // `stream: false` always yields a ChatResult, but the SDK overload still returns the stream union.
      const result = (await client.chat.send({
        chatRequest: {
          model: MODEL,
          messages: [{ role: "user", content: prompt }],
          reasoning: { effort: "medium" },
          responseFormat: {
            type: "json_schema",
            jsonSchema: { name: "output", schema: z.toJSONSchema(schema), strict: true },
          },
          stream: false,
        },
      })) as ChatResult;
      const content = result.choices[0]?.message.content;

      if (typeof content !== "string") throw new Error("LLM returned no text content");
      return schema.parse(JSON.parse(content));
    },
  };
}
