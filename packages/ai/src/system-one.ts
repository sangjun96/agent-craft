import type {
  DecisionsChoiceAnswer,
  DecisionsChoiceQuestion,
  DecisionsNoulAnswer,
  DecisionsNoulQuestion,
  DecisionsRequest,
  DecisionsResponseUsage,
  DecisionsScoreAnswer,
  DecisionsScoreQuestion,
} from "@openrouter/sdk/models";

const MODEL = "typesafe/jev-1.14";

/** An image anywhere in `state`. Jev takes PNG/JPEG base64 data URLs only (`data:image/png;base64,...`). */
export type ImagePart = { type: "image_url"; image_url: { url: string } };

/** Locates a described target in an image. Always returns a box, so pair it with a noul question to check presence. */
export type BoxQuestion = { type: "box"; instructions: DecisionsNoulQuestion["instructions"] };

/** Edges as fractions of the image width (left/right) and height (top/bottom), from the top-left corner. */
export type BoxAnswer = {
  type: "box";
  box: { top: number; bottom: number; left: number; right: number };
  confidence?: number;
};

export type Question =
  | DecisionsChoiceQuestion
  | DecisionsNoulQuestion
  | DecisionsScoreQuestion
  | BoxQuestion;

export type Answer = DecisionsChoiceAnswer | DecisionsNoulAnswer | DecisionsScoreAnswer | BoxAnswer;

export function createSystemOne(options: {
  apiKey: string;
  /** Called with token counts and cost after each successful request. */
  onUsage?: (usage: DecisionsResponseUsage) => void;
}) {
  return {
    /** Asks Jev the typed questions about `state`; answers come back keyed by question id. */
    async decide(
      state: DecisionsRequest["state"],
      questions: Record<string, Question>,
    ): Promise<Record<string, Answer>> {
      // The SDK's request validation predates box questions, and image input is only documented for the Decisions API.
      const response = await fetch("https://openrouter.ai/api/alpha/decisions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${options.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ model: MODEL, state, questions }),
      });

      if (!response.ok) {
        throw new Error(`Decisions request failed (${response.status}): ${await response.text()}`);
      }
      const { answers, usage } = (await response.json()) as {
        answers: Record<string, Answer>;
        usage: { input_tokens: number; output_tokens: number; cost?: number };
      };
      options.onUsage?.({
        inputTokens: usage.input_tokens,
        outputTokens: usage.output_tokens,
        cost: usage.cost,
      });
      return answers;
    },
  };
}
