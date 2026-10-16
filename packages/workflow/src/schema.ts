import * as z from "zod";

export type RetryBackoff = "constant" | "linear" | "exponential";

export type RetryConfig = {
  maxAttempts: number;
  backoffMs?: number;
  backoff?: RetryBackoff;
};

export const retryConfigSchema = z.object({
  maxAttempts: z.number().int().min(1),
  backoffMs: z.number().nonnegative().optional(),
  backoff: z.enum(["constant", "linear", "exponential"]).optional(),
});

export type JsonSchema = Record<string, unknown>;

export const jsonSchemaSchema: z.ZodType<JsonSchema> = z.record(z.string(), z.unknown());

export type PromptTextPart = {
  type: "text";
  text: string;
};

export type PromptImageUrlPart = {
  type: "image_url";
  imageUrl: string;
};

export type PromptCustomPart = {
  type: string;
  [key: string]: unknown;
};

export type PromptPart = PromptTextPart | PromptImageUrlPart | PromptCustomPart;

export type PromptTemplateContent = string | PromptPart[];

export const promptPartSchema = z
  .discriminatedUnion("type", [
    z.object({
      type: z.literal("text"),
      text: z.string(),
    }),
    z.object({
      type: z.literal("image_url"),
      imageUrl: z.string(),
    }),
  ])
  .or(
    z
      .object({
        type: z.string(),
      })
      .passthrough(),
  );

export const promptTemplateContentSchema = z.union([z.string(), z.array(promptPartSchema)]);

export type ReasoningEffort = "low" | "medium" | "high";

export type PromptTemplate = {
  id: string;
  version: string | number;
  model?: string;
  prompt: PromptTemplateContent;
  outputSchema?: JsonSchema;
  reasoningEffort?: ReasoningEffort;
  temperature?: number;
};

export const promptTemplateSchema = z.object({
  id: z.string().min(1),
  version: z.union([z.string().min(1), z.number()]),
  model: z.string().optional(),
  prompt: promptTemplateContentSchema,
  outputSchema: jsonSchemaSchema.optional(),
  reasoningEffort: z.enum(["low", "medium", "high"]).optional(),
  temperature: z.number().min(0).max(2).optional(),
});

export type BlockBase = {
  id: string;
  label?: string;
  version?: string | number;
  retry?: RetryConfig;
  timeoutMs?: number;
};

export const blockBaseSchema = z.object({
  id: z.string().min(1),
  label: z.string().optional(),
  version: z.union([z.string().min(1), z.number()]).optional(),
  retry: retryConfigSchema.optional(),
  timeoutMs: z.number().int().positive().optional(),
});

export type ConditionOperator =
  | "eq"
  | "neq"
  | "gt"
  | "gte"
  | "lt"
  | "lte"
  | "in"
  | "contains"
  | "exists";

export type ConditionVarExpr = {
  var: string;
  eq?: unknown;
  neq?: unknown;
  gt?: number | string;
  gte?: number | string;
  lt?: number | string;
  lte?: number | string;
  in?: unknown[];
  contains?: unknown;
  exists?: boolean;
};

export type ConditionOpExpr = {
  op: ConditionOperator;
  left: unknown;
  right?: unknown;
};

export type ConditionLogicalExpr =
  | { and: ConditionExpr[] }
  | { or: ConditionExpr[] }
  | { not: ConditionExpr };

export type ConditionExpr = ConditionLogicalExpr | ConditionVarExpr | ConditionOpExpr;

export const conditionExprSchema: z.ZodType<ConditionExpr> = z.lazy(() =>
  z.union([
    z.object({
      and: z.array(conditionExprSchema),
    }),
    z.object({
      or: z.array(conditionExprSchema),
    }),
    z.object({
      not: conditionExprSchema,
    }),
    z.object({
      var: z.string(),
      eq: z.unknown().optional(),
      neq: z.unknown().optional(),
      gt: z.union([z.number(), z.string()]).optional(),
      gte: z.union([z.number(), z.string()]).optional(),
      lt: z.union([z.number(), z.string()]).optional(),
      lte: z.union([z.number(), z.string()]).optional(),
      in: z.array(z.unknown()).optional(),
      contains: z.unknown().optional(),
      exists: z.boolean().optional(),
    }),
    z.object({
      op: z.enum(["eq", "neq", "gt", "gte", "lt", "lte", "in", "contains", "exists"]),
      left: z.unknown(),
      right: z.unknown().optional(),
    }),
  ]),
);

export type SequenceBlock = BlockBase & {
  type: "sequence";
  steps: WorkflowBlock[];
};

export type MapBlock = BlockBase & {
  type: "map";
  items: string;
  concurrency?: number;
  onError?: "fail-fast" | "continue";
  step: WorkflowBlock;
};

export type ParallelBlock = BlockBase & {
  type: "parallel";
  concurrency?: number;
  onError?: "fail-fast" | "continue";
  branches: WorkflowBlock[];
};

export type IfBlock = BlockBase & {
  type: "if";
  condition: ConditionExpr;
  then: WorkflowBlock;
  else?: WorkflowBlock;
};

export type TransformBlock = BlockBase & {
  type: "transform";
  value: unknown;
};

export type LlmBlock = BlockBase & {
  type: "llm";
  ref?: string;
  model?: string;
  prompt?: PromptTemplateContent;
  outputSchema?: JsonSchema;
  reasoningEffort?: ReasoningEffort;
  temperature?: number;
};

export type DecisionQuestionType =
  | "categorical"
  | "numerical"
  | "boolean"
  | "free_form"
  | (string & {});

export type DecisionQuestionTemplate = {
  type: DecisionQuestionType;
  question: string;
  options?: string[];
  min?: number;
  max?: number;
  description?: string;
};

export const decisionQuestionSchema = z.object({
  type: z.string(),
  question: z.string().min(1),
  options: z.array(z.string()).optional(),
  min: z.number().optional(),
  max: z.number().optional(),
  description: z.string().optional(),
});

export type DecisionBlock = BlockBase & {
  type: "decision";
  state: PromptTemplateContent;
  questions: Record<string, DecisionQuestionTemplate>;
};

export type SearchBlock = BlockBase & {
  type: "search";
  query: string;
  numResults?: number;
  text?: boolean | { maxCharacters: number };
  highlights?: boolean;
};

export type SpeechTurnTemplate = {
  voice: string;
  text: string;
  instructions?: string;
};

export const speechTurnSchema = z.object({
  voice: z.string().min(1),
  text: z.string(),
  instructions: z.string().optional(),
});

export type SpeechBlock = BlockBase & {
  type: "speech";
  turns: SpeechTurnTemplate[];
};

export type CustomBlock = BlockBase & {
  type: "custom";
  handler: string;
  input?: unknown;
};

export type WorkflowBlock =
  | SequenceBlock
  | MapBlock
  | ParallelBlock
  | IfBlock
  | TransformBlock
  | LlmBlock
  | DecisionBlock
  | SearchBlock
  | SpeechBlock
  | CustomBlock;

export const workflowBlockSchema: z.ZodType<WorkflowBlock> = z.lazy(() =>
  z.discriminatedUnion("type", [
    blockBaseSchema.extend({
      type: z.literal("sequence"),
      steps: z.array(workflowBlockSchema),
    }),
    blockBaseSchema.extend({
      type: z.literal("map"),
      items: z.string().min(1),
      concurrency: z.number().int().positive().optional(),
      onError: z.enum(["fail-fast", "continue"]).optional(),
      step: workflowBlockSchema,
    }),
    blockBaseSchema.extend({
      type: z.literal("parallel"),
      concurrency: z.number().int().positive().optional(),
      onError: z.enum(["fail-fast", "continue"]).optional(),
      branches: z.array(workflowBlockSchema),
    }),
    blockBaseSchema.extend({
      type: z.literal("if"),
      condition: conditionExprSchema,
      // oxlint-disable-next-line unicorn/no-thenable
      then: workflowBlockSchema,
      else: workflowBlockSchema.optional(),
    }),
    blockBaseSchema.extend({
      type: z.literal("transform"),
      value: z.unknown(),
    }),
    blockBaseSchema
      .extend({
        type: z.literal("llm"),
        ref: z.string().optional(),
        model: z.string().optional(),
        prompt: promptTemplateContentSchema.optional(),
        outputSchema: jsonSchemaSchema.optional(),
        reasoningEffort: z.enum(["low", "medium", "high"]).optional(),
        temperature: z.number().min(0).max(2).optional(),
      })
      .refine((data) => Boolean(data.ref || data.prompt), {
        message: "LlmBlock must specify either 'ref' or 'prompt'",
      }),
    blockBaseSchema.extend({
      type: z.literal("decision"),
      state: promptTemplateContentSchema,
      questions: z.record(z.string(), decisionQuestionSchema),
    }),
    blockBaseSchema.extend({
      type: z.literal("search"),
      query: z.string().min(1),
      numResults: z.number().int().positive().optional(),
      text: z
        .union([z.boolean(), z.object({ maxCharacters: z.number().int().positive() })])
        .optional(),
      highlights: z.boolean().optional(),
    }),
    blockBaseSchema.extend({
      type: z.literal("speech"),
      turns: z.array(speechTurnSchema),
    }),
    blockBaseSchema.extend({
      type: z.literal("custom"),
      handler: z.string().min(1),
      input: z.unknown().optional(),
    }),
  ]),
);

export type WorkflowDefinition = {
  id: string;
  name: string;
  version: string | number;
  description?: string;
  inputSchema?: JsonSchema;
  prompts?: PromptTemplate[];
  root: WorkflowBlock;
};

export const workflowDefinitionSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  version: z.union([z.string().min(1), z.number()]),
  description: z.string().optional(),
  inputSchema: jsonSchemaSchema.optional(),
  prompts: z.array(promptTemplateSchema).optional(),
  root: workflowBlockSchema,
});

export function parseWorkflow(input: unknown): WorkflowDefinition {
  return workflowDefinitionSchema.parse(input);
}

export function parsePromptTemplate(input: unknown): PromptTemplate {
  return promptTemplateSchema.parse(input);
}

export function parsePromptRef(ref: string): { id: string; version?: string } {
  const atIndex = ref.indexOf("@");
  if (atIndex === -1) {
    return { id: ref };
  }
  return {
    id: ref.slice(0, atIndex),
    version: ref.slice(atIndex + 1),
  };
}

export function resolvePromptTemplate(
  ref: string,
  sources: Array<PromptTemplate[] | undefined>,
): PromptTemplate {
  const { id, version } = parsePromptRef(ref);

  for (const list of sources) {
    if (!list) continue;
    for (const prompt of list) {
      if (prompt.id === id) {
        if (!version || String(prompt.version) === String(version)) {
          return prompt;
        }
      }
    }
  }

  throw new Error(`Prompt reference not found: ${ref}`);
}
