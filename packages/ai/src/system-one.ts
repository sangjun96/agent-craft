import { OpenRouter } from "@openrouter/sdk";
import type { DecisionsRequest, DecisionsResponse } from "@openrouter/sdk/models";

const MODEL = "jev-latest";

export function createSystemOne(options: { apiKey: string }) {
  const client = new OpenRouter({ apiKey: options.apiKey });

  return {
    /** Asks Jev the typed questions about `state`; answers come back keyed by question id. */
    async decide(
      state: DecisionsRequest["state"],
      questions: DecisionsRequest["questions"],
    ): Promise<DecisionsResponse["answers"]> {
      const { answers } = await client.systemOne.create({
        decisionsRequest: { model: MODEL, state, questions },
      });
      return answers;
    },
  };
}
