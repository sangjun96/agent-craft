import type { EvalContext } from "./expression.js";
import type { JsonSchema, PromptTemplate, ReasoningEffort, WorkflowBlock } from "./schema.js";

export type WorkflowStepRetryConfig = {
  limit: number;
  delay: string | number;
  backoff?: "constant" | "linear" | "exponential";
};

export type WorkflowStepConfig = {
  retries?: WorkflowStepRetryConfig;
  timeout?: string | number;
};

/**
 * Structural interface compatible with Cloudflare Workflows `WorkflowStep`.
 * Allows direct injection of `step` inside Cloudflare Workflows entrypoints.
 */
export interface WorkflowStepRunner {
  do<T>(name: string, callback: () => Promise<T>): Promise<T>;
  do<T>(name: string, config: WorkflowStepConfig, callback: () => Promise<T>): Promise<T>;
  sleep?(name: string, duration: string | number): Promise<void>;
}

export type WorkflowUsage = {
  inputTokens: number;
  outputTokens: number;
  cost: number;
};

export function sumUsage(usages: Array<WorkflowUsage | undefined | null>): WorkflowUsage {
  return usages.reduce<WorkflowUsage>(
    (acc, u) => ({
      inputTokens: acc.inputTokens + (u?.inputTokens ?? 0),
      outputTokens: acc.outputTokens + (u?.outputTokens ?? 0),
      cost: Number((acc.cost + (u?.cost ?? 0)).toFixed(6)),
    }),
    { inputTokens: 0, outputTokens: 0, cost: 0 },
  );
}

export type SpanStatus = "pending" | "running" | "done" | "cached" | "skipped" | "error";

export type NodeSpan = {
  spanId: string;
  parentSpanId?: string;
  nodeId: string;
  /** Cloudflare Workflow step.do name (e.g. "extract@v1#8f3a1b2c") */
  stepKey?: string;
  nodeType: WorkflowBlock["type"];
  label?: string;
  version?: string | number;
  promptRef?: string;
  configHash: string;
  inputHash?: string;
  iterationIndex?: number;
  status: SpanStatus;
  startedAt: number;
  finishedAt?: number;
  durationMs?: number;
  input?: unknown;
  renderedRequest?: unknown;
  output?: unknown;
  usage?: WorkflowUsage;
  attempts?: number;
  error?: string;
  children: NodeSpan[];
};

export type WorkflowTrace = {
  runId: string;
  workflowId: string;
  workflowVersion: string | number;
  status: "running" | "done" | "error";
  startedAt: number;
  finishedAt?: number;
  durationMs?: number;
  input: unknown;
  output?: unknown;
  usage: WorkflowUsage;
  rootSpan: NodeSpan;
  stepOutputs: Record<string, unknown>;
  error?: string;
};

/**
 * Envelope stored and returned by `step.do` so that on Cloudflare Workflow replay/hibernation,
 * the entire trace metadata (usage, duration, rendered request) is accurately preserved.
 */
export type DurableStepEnvelope<T = unknown> = {
  output: T;
  usage?: WorkflowUsage;
  renderedRequest?: unknown;
  startedAt: number;
  finishedAt: number;
  durationMs: number;
  attempts?: number;
};

export type LlmProviderRequest = {
  model?: string;
  prompt: unknown;
  outputSchema?: JsonSchema;
  reasoningEffort?: ReasoningEffort;
  temperature?: number;
};

export type DecisionProviderRequest = {
  state: unknown;
  questions: Record<string, unknown>;
};

export type SearchProviderRequest = {
  query: string;
  numResults?: number;
  text?: boolean | { maxCharacters: number };
  highlights?: boolean;
};

export type SpeechProviderRequest = {
  turns: Array<{ voice: string; text: string; instructions?: string }>;
};

export type CustomBlockContext = {
  nodeId: string;
  ctx: EvalContext;
  signal?: AbortSignal;
};

export type WorkflowProviders = {
  llm?: (
    request: LlmProviderRequest,
    signal?: AbortSignal,
  ) => Promise<{ output: unknown; usage?: WorkflowUsage }>;
  decision?: (
    request: DecisionProviderRequest,
    signal?: AbortSignal,
  ) => Promise<{ answers: Record<string, unknown>; usage?: WorkflowUsage }>;
  search?: (
    request: SearchProviderRequest,
    signal?: AbortSignal,
  ) => Promise<{ results: unknown[]; usage?: WorkflowUsage }>;
  speech?: (
    request: SpeechProviderRequest,
    signal?: AbortSignal,
  ) => Promise<{ audio: Uint8Array | string; usage?: WorkflowUsage }>;
  custom?: Record<
    string,
    (input: unknown, ctx: CustomBlockContext) => Promise<{ output: unknown; usage?: WorkflowUsage }>
  >;
};

export type WorkflowEvent =
  | { type: "run:start"; runId: string; workflowId: string; timestamp: number }
  | {
      type: "run:finish";
      runId: string;
      status: "done" | "error";
      durationMs: number;
      usage: WorkflowUsage;
      timestamp: number;
    }
  | { type: "span:start"; span: NodeSpan; timestamp: number }
  | { type: "span:finish"; span: NodeSpan; timestamp: number };

export type RunWorkflowOptions = {
  input: unknown;
  providers: WorkflowProviders;
  step?: WorkflowStepRunner;
  prompts?: PromptTemplate[];
  previousTrace?: WorkflowTrace;
  resumeFrom?: string;
  seedOutputs?: Record<string, unknown>;
  onTraceUpdate?: (trace: WorkflowTrace) => void;
  onEvent?: (event: WorkflowEvent) => void;
  signal?: AbortSignal;
};
