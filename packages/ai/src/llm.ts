import { OpenRouter } from "@openrouter/sdk";
import type { ChatResult as SdkChatResult } from "@openrouter/sdk/models";

export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type ChatRequest = {
  model: string;
  messages: ChatMessage[];
  temperature?: number;
  maxTokens?: number;
};

export type ChatResult = {
  text: string;
  model: string;
  usage?: { inputTokens: number; outputTokens: number };
};

export function createLlm(options: { apiKey: string }) {
  const client = new OpenRouter({ apiKey: options.apiKey });

  return {
    async chat(request: ChatRequest): Promise<ChatResult> {
      // `stream: false` always yields a ChatResult, but the SDK overload still returns the stream union.
      const result = (await client.chat.send({
        chatRequest: {
          model: request.model,
          messages: request.messages,
          temperature: request.temperature,
          maxTokens: request.maxTokens,
          stream: false,
        },
      })) as SdkChatResult;
      const content = result.choices[0]?.message.content;

      return {
        text:
          typeof content === "string"
            ? content
            : (content ?? []).map((part) => (part.type === "text" ? part.text : "")).join(""),
        model: result.model,
        usage: result.usage && {
          inputTokens: result.usage.promptTokens,
          outputTokens: result.usage.completionTokens,
        },
      };
    },
  };
}
