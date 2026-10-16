import {
  parsePromptTemplate,
  parseWorkflow,
  type ConditionExpr,
  type CustomBlock,
  type DecisionBlock,
  type DecisionQuestionTemplate,
  type IfBlock,
  type JsonSchema,
  type LlmBlock,
  type MapBlock,
  type ParallelBlock,
  type PromptTemplate,
  type PromptTemplateContent,
  type ReasoningEffort,
  type RetryConfig,
  type SearchBlock,
  type SequenceBlock,
  type SpeechBlock,
  type SpeechTurnTemplate,
  type TransformBlock,
  type WorkflowBlock,
  type WorkflowDefinition,
} from "./schema.js";

/**
 * Validate and define a WorkflowDefinition.
 */
export function defineWorkflow(def: WorkflowDefinition): WorkflowDefinition {
  return parseWorkflow(def);
}

/**
 * Validate and define a PromptTemplate.
 */
export function definePrompt(prompt: PromptTemplate): PromptTemplate {
  return parsePromptTemplate(prompt);
}

export type BaseBlockArgs = {
  id: string;
  label?: string;
  version?: string | number;
  retry?: RetryConfig;
  timeoutMs?: number;
};

export const block = {
  sequence(opts: BaseBlockArgs & { steps: WorkflowBlock[] }): SequenceBlock {
    return {
      type: "sequence",
      id: opts.id,
      label: opts.label,
      version: opts.version,
      retry: opts.retry,
      timeoutMs: opts.timeoutMs,
      steps: opts.steps,
    };
  },

  map(
    opts: BaseBlockArgs & {
      items: string;
      concurrency?: number;
      onError?: "fail-fast" | "continue";
      step: WorkflowBlock;
    },
  ): MapBlock {
    return {
      type: "map",
      id: opts.id,
      label: opts.label,
      version: opts.version,
      retry: opts.retry,
      timeoutMs: opts.timeoutMs,
      items: opts.items,
      concurrency: opts.concurrency,
      onError: opts.onError,
      step: opts.step,
    };
  },

  parallel(
    opts: BaseBlockArgs & {
      concurrency?: number;
      onError?: "fail-fast" | "continue";
      branches: WorkflowBlock[];
    },
  ): ParallelBlock {
    return {
      type: "parallel",
      id: opts.id,
      label: opts.label,
      version: opts.version,
      retry: opts.retry,
      timeoutMs: opts.timeoutMs,
      concurrency: opts.concurrency,
      onError: opts.onError,
      branches: opts.branches,
    };
  },

  if(
    opts: BaseBlockArgs & {
      condition: ConditionExpr;
      then: WorkflowBlock;
      else?: WorkflowBlock;
    },
  ): IfBlock {
    return {
      type: "if",
      id: opts.id,
      label: opts.label,
      version: opts.version,
      retry: opts.retry,
      timeoutMs: opts.timeoutMs,
      condition: opts.condition,
      // oxlint-disable-next-line unicorn/no-thenable
      then: opts.then,
      else: opts.else,
    };
  },

  transform(opts: BaseBlockArgs & { value: unknown }): TransformBlock {
    return {
      type: "transform",
      id: opts.id,
      label: opts.label,
      version: opts.version,
      retry: opts.retry,
      timeoutMs: opts.timeoutMs,
      value: opts.value,
    };
  },

  llm(
    opts: BaseBlockArgs & {
      ref?: string;
      model?: string;
      prompt?: PromptTemplateContent;
      outputSchema?: JsonSchema;
      reasoningEffort?: ReasoningEffort;
      temperature?: number;
    },
  ): LlmBlock {
    return {
      type: "llm",
      id: opts.id,
      label: opts.label,
      version: opts.version,
      retry: opts.retry,
      timeoutMs: opts.timeoutMs,
      ref: opts.ref,
      model: opts.model,
      prompt: opts.prompt,
      outputSchema: opts.outputSchema,
      reasoningEffort: opts.reasoningEffort,
      temperature: opts.temperature,
    };
  },

  decision(
    opts: BaseBlockArgs & {
      state: PromptTemplateContent;
      questions: Record<string, DecisionQuestionTemplate>;
    },
  ): DecisionBlock {
    return {
      type: "decision",
      id: opts.id,
      label: opts.label,
      version: opts.version,
      retry: opts.retry,
      timeoutMs: opts.timeoutMs,
      state: opts.state,
      questions: opts.questions,
    };
  },

  search(
    opts: BaseBlockArgs & {
      query: string;
      numResults?: number;
      text?: boolean | { maxCharacters: number };
      highlights?: boolean;
    },
  ): SearchBlock {
    return {
      type: "search",
      id: opts.id,
      label: opts.label,
      version: opts.version,
      retry: opts.retry,
      timeoutMs: opts.timeoutMs,
      query: opts.query,
      numResults: opts.numResults,
      text: opts.text,
      highlights: opts.highlights,
    };
  },

  speech(
    opts: BaseBlockArgs & {
      turns: SpeechTurnTemplate[];
    },
  ): SpeechBlock {
    return {
      type: "speech",
      id: opts.id,
      label: opts.label,
      version: opts.version,
      retry: opts.retry,
      timeoutMs: opts.timeoutMs,
      turns: opts.turns,
    };
  },

  custom(
    opts: BaseBlockArgs & {
      handler: string;
      input?: unknown;
    },
  ): CustomBlock {
    return {
      type: "custom",
      id: opts.id,
      label: opts.label,
      version: opts.version,
      retry: opts.retry,
      timeoutMs: opts.timeoutMs,
      handler: opts.handler,
      input: opts.input,
    };
  },
};

/**
 * `step` is an ergonomic alias for `block`.
 */
export const step = block;
