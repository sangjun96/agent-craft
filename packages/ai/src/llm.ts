import { OpenRouter } from "@openrouter/sdk";
import type { ChatResult, ChatUserMessage } from "@openrouter/sdk/models";
import * as z from "zod";

const MODEL = "google/gemini-3.8-flash";

export type LlmUsage = { inputTokens: number; outputTokens: number; cost?: number };

export function createLlm(options: {
  apiKey: string;
  /** Called with token counts and cost after each successful request. */
  onUsage?: (usage: LlmUsage) => void;
}) {
  const client = new OpenRouter({ apiKey: options.apiKey });

  return {
    async generateObject<T extends z.ZodType>(
      prompt: ChatUserMessage["content"],
      schema: T,
    ): Promise<z.infer<T>> {
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
      if (result.usage) {
        options.onUsage?.({
          inputTokens: result.usage.promptTokens,
          outputTokens: result.usage.completionTokens,
          // With BYOK OpenRouter bills only its own fee (often 0); the provider's charge is reported separately.
          cost:
            (result.usage.cost ?? 0) +
            (result.usage.isByok ? (result.usage.costDetails?.upstreamInferenceCost ?? 0) : 0),
        });
      }
      const content = result.choices[0]?.message.content;

      if (typeof content !== "string") throw new Error("LLM returned no text content");
      return schema.parse(JSON.parse(content));
    },
  };
}
