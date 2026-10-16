import {
  evaluateCondition,
  renderTemplate,
  resolvePath,
  resolveValue,
  type EvalContext,
} from "./expression.js";
import { computeConfigHash, computeInputHash } from "./hash.js";
import { validateJsonSchema } from "./json-schema.js";
import {
  parseWorkflow,
  resolvePromptTemplate,
  type CustomBlock,
  type DecisionBlock,
  type IfBlock,
  type LlmBlock,
  type MapBlock,
  type ParallelBlock,
  type PromptTemplate,
  type SearchBlock,
  type SequenceBlock,
  type SpeechBlock,
  type TransformBlock,
  type WorkflowBlock,
  type WorkflowDefinition,
} from "./schema.js";
import {
  sumUsage,
  type DurableStepEnvelope,
  type NodeSpan,
  type RunWorkflowOptions,
  type SpanStatus,
  type WorkflowEvent,
  type WorkflowStepConfig,
  type WorkflowStepRunner,
  type WorkflowTrace,
  type WorkflowUsage,
} from "./types.js";

function parseDurationMs(duration: string | number | undefined, defaultMs = 1000): number {
  if (typeof duration === "number") {
    return duration;
  }
  if (typeof duration === "string") {
    const trimmed = duration.trim();
    if (
      trimmed.endsWith("ms") ||
      trimmed.endsWith("millisecond") ||
      trimmed.endsWith("milliseconds")
    ) {
      return Number.parseFloat(trimmed);
    }
    if (trimmed.endsWith("s") || trimmed.endsWith("second") || trimmed.endsWith("seconds")) {
      return Number.parseFloat(trimmed) * 1000;
    }
    if (trimmed.endsWith("m") || trimmed.endsWith("minute") || trimmed.endsWith("minutes")) {
      return Number.parseFloat(trimmed) * 60 * 1000;
    }
    const num = Number.parseFloat(trimmed);
    return Number.isNaN(num) ? defaultMs : num;
  }
  return defaultMs;
}

/**
 * In-memory fallback for WorkflowStepRunner with retries, backoff, and timeout.
 */
export class InMemoryStepRunner implements WorkflowStepRunner {
  async do<T>(
    name: string,
    configOrCallback: WorkflowStepConfig | (() => Promise<T>),
    maybeCallback?: () => Promise<T>,
  ): Promise<T> {
    const config = typeof configOrCallback === "function" ? undefined : configOrCallback;
    const callback = typeof configOrCallback === "function" ? configOrCallback : maybeCallback;

    if (!callback) {
      throw new Error(`Callback missing for step.do: ${name}`);
    }

    const retries = config?.retries;
    const limit = retries?.limit ?? 0;
    const maxAttempts = limit + 1;
    const baseDelayMs = parseDurationMs(retries?.delay, 1000);
    const backoffType = retries?.backoff ?? "exponential";
    const timeoutMs = config?.timeout ? parseDurationMs(config.timeout) : undefined;

    let lastError: unknown;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        if (timeoutMs && timeoutMs > 0) {
          return await Promise.race([
            callback(),
            new Promise<never>((_, reject) => {
              setTimeout(() => {
                reject(new Error(`Step '${name}' timed out after ${timeoutMs}ms`));
              }, timeoutMs);
            }),
          ]);
        }
        return await callback();
      } catch (err) {
        lastError = err;
        if (attempt < maxAttempts) {
          let delay = baseDelayMs;
          if (backoffType === "linear") {
            delay = baseDelayMs * attempt;
          } else if (backoffType === "exponential") {
            delay = baseDelayMs * Math.pow(2, attempt - 1);
          }
          if (delay > 0) {
            await this.sleep(`sleep-retry-${attempt}`, delay);
          }
        }
      }
    }

    throw lastError;
  }

  async sleep(_name: string, duration: string | number): Promise<void> {
    const ms = parseDurationMs(duration, 0);
    if (ms <= 0) return;
    await new Promise((resolve) => setTimeout(resolve, ms));
  }
}

/**
 * Concurrency limiter queue (p-limit pattern).
 */
function createConcurrencyPool(concurrency?: number) {
  if (!concurrency || concurrency <= 0 || !Number.isFinite(concurrency)) {
    return <T>(fn: () => Promise<T>): Promise<T> => fn();
  }

  let activeCount = 0;
  const queue: Array<() => void> = [];

  const next = () => {
    activeCount--;
    if (queue.length > 0) {
      const run = queue.shift();
      run?.();
    }
  };

  return <T>(fn: () => Promise<T>): Promise<T> => {
    return new Promise<T>((resolve, reject) => {
      const execute = () => {
        activeCount++;
        fn()
          .then((val) => {
            resolve(val);
            next();
          })
          .catch((err) => {
            reject(err);
            next();
          });
      };

      if (activeCount < concurrency) {
        execute();
      } else {
        queue.push(execute);
      }
    });
  };
}

/**
 * Flatten all spans from a trace into a lookup map by key `${nodeId}#${iterationIndex ?? "root"}`.
 */
function buildSpanCacheIndex(span: NodeSpan, map: Map<string, NodeSpan>): void {
  const key = `${span.nodeId}#${span.iterationIndex ?? "root"}`;
  map.set(key, span);
  for (const child of span.children) {
    buildSpanCacheIndex(child, map);
  }
}

function cloneTrace(trace: WorkflowTrace): WorkflowTrace {
  return JSON.parse(JSON.stringify(trace)) as WorkflowTrace;
}

/**
 * Main workflow runner function.
 */
export async function runWorkflow(
  workflowDef: WorkflowDefinition,
  options: RunWorkflowOptions,
): Promise<WorkflowTrace> {
  const workflow = parseWorkflow(workflowDef);
  const runId = globalThis.crypto.randomUUID();
  const startTime = Date.now();
  const stepRunner: WorkflowStepRunner = options.step ?? new InMemoryStepRunner();
  const stepOutputs: Record<string, unknown> = {};

  const previousSpans = new Map<string, NodeSpan>();
  if (options.previousTrace) {
    buildSpanCacheIndex(options.previousTrace.rootSpan, previousSpans);
  }

  const rootSpan: NodeSpan = {
    spanId: globalThis.crypto.randomUUID(),
    nodeId: workflow.root.id,
    nodeType: workflow.root.type,
    label: workflow.root.label ?? workflow.name,
    version: workflow.root.version ?? workflow.version,
    configHash: "",
    status: "running",
    startedAt: startTime,
    children: [],
  };

  const trace: WorkflowTrace = {
    runId,
    workflowId: workflow.id,
    workflowVersion: workflow.version,
    status: "running",
    startedAt: startTime,
    input: options.input,
    usage: { inputTokens: 0, outputTokens: 0, cost: 0 },
    rootSpan,
    stepOutputs,
  };

  const emitEvent = (event: WorkflowEvent) => {
    try {
      options.onEvent?.(event);
    } catch {
      // Event listener errors should not break workflow execution
    }
  };

  const updateTrace = () => {
    try {
      options.onTraceUpdate?.(cloneTrace(trace));
    } catch {
      // Trace update errors should not break workflow execution
    }
  };

  emitEvent({
    type: "run:start",
    runId,
    workflowId: workflow.id,
    timestamp: startTime,
  });
  updateTrace();

  const evalCtx: EvalContext = {
    input: options.input,
    steps: stepOutputs,
  };

  // Helper to execute any block
  async function executeBlock(
    block: WorkflowBlock,
    ctx: EvalContext,
    parentSpan: NodeSpan | undefined,
    stepPath: string,
    iterationIndex?: number,
  ): Promise<unknown> {
    options.signal?.throwIfAborted();

    const spanId = globalThis.crypto.randomUUID();
    const spanStartTime = Date.now();

    // Resolve prompt template if this is an LLM block with ref
    let resolvedPrompt: PromptTemplate | undefined;
    if (block.type === "llm" && block.ref) {
      resolvedPrompt = resolvePromptTemplate(block.ref, [options.prompts, workflow.prompts]);
    }

    const configHash = await computeConfigHash(block, resolvedPrompt);
    const inputForHash = {
      input: ctx.input,
      item: ctx.item,
      index: ctx.index,
      steps: ctx.steps,
    };
    const inputHash = await computeInputHash(inputForHash);

    const span: NodeSpan = parentSpan
      ? {
          spanId,
          parentSpanId: parentSpan.spanId,
          nodeId: block.id,
          nodeType: block.type,
          label: block.label ?? block.id,
          version: block.version ?? resolvedPrompt?.version,
          promptRef: block.type === "llm" ? block.ref : undefined,
          configHash,
          inputHash,
          iterationIndex,
          status: "running",
          startedAt: spanStartTime,
          input: ctx.item !== undefined ? { item: ctx.item, index: ctx.index } : ctx.input,
          children: [],
        }
      : rootSpan;

    if (parentSpan) {
      parentSpan.children.push(span);
    } else {
      rootSpan.configHash = configHash;
      rootSpan.inputHash = inputHash;
      rootSpan.version = block.version ?? resolvedPrompt?.version;
      rootSpan.promptRef = block.type === "llm" ? block.ref : undefined;
      rootSpan.input = ctx.input;
    }

    emitEvent({ type: "span:start", span, timestamp: spanStartTime });
    updateTrace();

    // Check seedOutputs
    if (
      options.seedOutputs &&
      Object.prototype.hasOwnProperty.call(options.seedOutputs, block.id)
    ) {
      const seededOutput = options.seedOutputs[block.id];
      const finishTime = Date.now();
      span.status = "cached";
      span.finishedAt = finishTime;
      span.durationMs = 0;
      span.output = seededOutput;
      span.usage = { inputTokens: 0, outputTokens: 0, cost: 0 };
      stepOutputs[block.id] = seededOutput;

      emitEvent({ type: "span:finish", span, timestamp: finishTime });
      updateTrace();
      return seededOutput;
    }

    // Check previousTrace replay cache
    const isControlBlock =
      block.type === "sequence" ||
      block.type === "map" ||
      block.type === "parallel" ||
      block.type === "if";

    const cacheKey = `${block.id}#${iterationIndex ?? "root"}`;
    const prevSpan = previousSpans.get(cacheKey);
    const canCheckCache =
      !isControlBlock &&
      prevSpan &&
      (prevSpan.status === "done" || prevSpan.status === "cached") &&
      (!options.resumeFrom || options.resumeFrom !== block.id);

    if (canCheckCache && prevSpan.configHash === configHash && prevSpan.inputHash === inputHash) {
      const finishTime = Date.now();
      span.status = "cached";
      span.finishedAt = finishTime;
      span.durationMs = 0;
      span.output = prevSpan.output;
      span.renderedRequest = prevSpan.renderedRequest;
      span.usage = { inputTokens: 0, outputTokens: 0, cost: 0 };
      stepOutputs[block.id] = prevSpan.output;

      emitEvent({ type: "span:finish", span, timestamp: finishTime });
      updateTrace();
      return prevSpan.output;
    }

    try {
      let output: unknown;

      switch (block.type) {
        case "sequence": {
          output = await executeSequence(block, ctx, span, stepPath);
          break;
        }
        case "map": {
          output = await executeMap(block, ctx, span, stepPath);
          break;
        }
        case "parallel": {
          output = await executeParallel(block, ctx, span, stepPath);
          break;
        }
        case "if": {
          output = await executeIf(block, ctx, span, stepPath);
          break;
        }
        case "transform": {
          output = executeTransform(block, ctx);
          break;
        }
        case "llm": {
          output = await executeLeafBlock(block, ctx, span, stepPath, configHash, resolvedPrompt);
          break;
        }
        case "decision":
        case "search":
        case "speech":
        case "custom": {
          output = await executeLeafBlock(block, ctx, span, stepPath, configHash);
          break;
        }
        default: {
          const exhaustiveCheck: never = block;
          throw new Error(`Unsupported block type: ${(exhaustiveCheck as { type?: string }).type}`);
        }
      }

      const finishTime = Date.now();
      span.status = "done";
      span.finishedAt = finishTime;
      if (span.durationMs === undefined) {
        span.durationMs = Math.max(0, finishTime - spanStartTime);
      }
      span.output = output;
      stepOutputs[block.id] = output;

      // Roll up usage from children if any
      const childUsages = span.children.map((c) => c.usage);
      if (childUsages.length > 0) {
        span.usage = sumUsage([span.usage, ...childUsages]);
      }

      emitEvent({ type: "span:finish", span, timestamp: finishTime });
      updateTrace();
      return output;
    } catch (err: unknown) {
      const finishTime = Date.now();
      const message = err instanceof Error ? err.message : String(err);
      span.status = "error";
      span.finishedAt = finishTime;
      span.durationMs = Math.max(0, finishTime - spanStartTime);
      span.error = message;

      emitEvent({ type: "span:finish", span, timestamp: finishTime });
      updateTrace();
      throw err;
    }
  }

  async function executeSequence(
    block: SequenceBlock,
    ctx: EvalContext,
    span: NodeSpan,
    stepPath: string,
  ): Promise<unknown> {
    let lastResult: unknown;
    for (const step of block.steps) {
      const childPath = `${stepPath}/${step.id}`;
      lastResult = await executeBlock(step, ctx, span, childPath);
      ctx.steps = { ...stepOutputs };
    }
    return lastResult;
  }

  async function executeMap(
    block: MapBlock,
    ctx: EvalContext,
    span: NodeSpan,
    stepPath: string,
  ): Promise<unknown[]> {
    const rawItems = resolvePath(block.items, ctx);
    if (!Array.isArray(rawItems)) {
      throw new Error(
        `Map block '${block.id}' items expression '${block.items}' did not evaluate to an array`,
      );
    }

    const pool = createConcurrencyPool(block.concurrency);
    const results: unknown[] = Array.from<unknown>({ length: rawItems.length });
    const onError = block.onError ?? "fail-fast";

    const tasks = rawItems.map((item, index) => {
      return pool(async () => {
        const itemCtx: EvalContext = {
          input: ctx.input,
          steps: { ...ctx.steps },
          item,
          index,
        };
        const childPath = `${stepPath}[${index}]/${block.step.id}`;

        try {
          const itemOutput = await executeBlock(block.step, itemCtx, span, childPath, index);
          results[index] = itemOutput;
        } catch (itemErr) {
          if (onError === "continue") {
            results[index] = undefined;
          } else {
            throw itemErr;
          }
        }
      });
    });

    await Promise.all(tasks);
    return results;
  }

  async function executeParallel(
    block: ParallelBlock,
    ctx: EvalContext,
    span: NodeSpan,
    stepPath: string,
  ): Promise<unknown[]> {
    const pool = createConcurrencyPool(block.concurrency);
    const results: unknown[] = Array.from<unknown>({ length: block.branches.length });
    const onError = block.onError ?? "fail-fast";

    const tasks = block.branches.map((branch, index) => {
      return pool(async () => {
        const branchCtx: EvalContext = {
          input: ctx.input,
          steps: { ...ctx.steps },
          item: ctx.item,
          index: ctx.index,
        };
        const childPath = `${stepPath}/${branch.id}`;

        try {
          const branchOutput = await executeBlock(branch, branchCtx, span, childPath);
          results[index] = branchOutput;
        } catch (branchErr) {
          if (onError === "continue") {
            results[index] = undefined;
          } else {
            throw branchErr;
          }
        }
      });
    });

    await Promise.all(tasks);
    return results;
  }

  async function executeIf(
    block: IfBlock,
    ctx: EvalContext,
    span: NodeSpan,
    stepPath: string,
  ): Promise<unknown> {
    const conditionResult = evaluateCondition(block.condition, ctx);

    if (conditionResult) {
      const thenResult = await executeBlock(
        block.then,
        ctx,
        span,
        `${stepPath}/then/${block.then.id}`,
      );
      if (block.else) {
        // Record skipped span for else
        const skippedSpan: NodeSpan = {
          spanId: globalThis.crypto.randomUUID(),
          parentSpanId: span.spanId,
          nodeId: block.else.id,
          nodeType: block.else.type,
          label: block.else.label ?? block.else.id,
          version: block.else.version,
          configHash: "",
          status: "skipped",
          startedAt: Date.now(),
          finishedAt: Date.now(),
          durationMs: 0,
          children: [],
        };
        span.children.push(skippedSpan);
      }
      return thenResult;
    }

    // Condition evaluated to false:
    const skippedSpan: NodeSpan = {
      spanId: globalThis.crypto.randomUUID(),
      parentSpanId: span.spanId,
      nodeId: block.then.id,
      nodeType: block.then.type,
      label: block.then.label ?? block.then.id,
      version: block.then.version,
      configHash: "",
      status: "skipped",
      startedAt: Date.now(),
      finishedAt: Date.now(),
      durationMs: 0,
      children: [],
    };
    span.children.push(skippedSpan);

    if (block.else) {
      return await executeBlock(block.else, ctx, span, `${stepPath}/else/${block.else.id}`);
    }

    return undefined;
  }

  function executeTransform(block: TransformBlock, ctx: EvalContext): unknown {
    return resolveValue(block.value, ctx);
  }

  /**
   * Execute leaf action block (llm, decision, search, speech, custom)
   * through Cloudflare step.do (or InMemoryStepRunner).
   */
  async function executeLeafBlock(
    block: LlmBlock | DecisionBlock | SearchBlock | SpeechBlock | CustomBlock,
    ctx: EvalContext,
    span: NodeSpan,
    stepPath: string,
    configHash: string,
    resolvedPrompt?: PromptTemplate,
  ): Promise<unknown> {
    const version = block.version ?? resolvedPrompt?.version ?? "v1";
    const stepKey = `${stepPath}@${version}#${configHash.slice(0, 8)}`;
    span.stepKey = stepKey;

    const stepConfig: WorkflowStepConfig = {};
    if (block.retry) {
      stepConfig.retries = {
        limit: Math.max(0, block.retry.maxAttempts - 1),
        delay: `${block.retry.backoffMs ?? 1000} millisecond`,
        backoff: block.retry.backoff ?? "exponential",
      };
    }
    if (block.timeoutMs) {
      stepConfig.timeout = `${block.timeoutMs} millisecond`;
    }

    const envelope = await stepRunner.do<DurableStepEnvelope>(stepKey, stepConfig, async () => {
      const leafStartTime = Date.now();
      let leafOutput: unknown;
      let leafUsage: WorkflowUsage | undefined;
      let renderedRequest: unknown;

      switch (block.type) {
        case "llm": {
          if (!options.providers.llm) {
            throw new Error(`Workflow provider 'llm' is not configured for block '${block.id}'`);
          }
          const model = block.model ?? resolvedPrompt?.model;
          const promptContent = block.prompt ?? resolvedPrompt?.prompt;
          const outputSchema = block.outputSchema ?? resolvedPrompt?.outputSchema;
          const reasoningEffort = block.reasoningEffort ?? resolvedPrompt?.reasoningEffort;
          const temperature = block.temperature ?? resolvedPrompt?.temperature;

          let renderedPrompt: unknown;
          if (typeof promptContent === "string") {
            renderedPrompt = renderTemplate(promptContent, ctx);
          } else if (Array.isArray(promptContent)) {
            renderedPrompt = promptContent.map((part) => {
              if (part.type === "text" && typeof (part as { text?: unknown }).text === "string") {
                return {
                  ...part,
                  text: renderTemplate((part as { text: string }).text, ctx),
                };
              }
              if (
                part.type === "image_url" &&
                typeof (part as { imageUrl?: unknown }).imageUrl === "string"
              ) {
                return {
                  ...part,
                  imageUrl: resolveValue((part as { imageUrl: string }).imageUrl, ctx),
                };
              }
              return resolveValue(part, ctx);
            });
          } else {
            renderedPrompt = promptContent;
          }

          renderedRequest = {
            model,
            prompt: renderedPrompt,
            outputSchema,
            reasoningEffort,
            temperature,
          };

          const result = await options.providers.llm(
            {
              model,
              prompt: renderedPrompt,
              outputSchema,
              reasoningEffort,
              temperature,
            },
            options.signal,
          );

          if (outputSchema) {
            const validation = validateJsonSchema(outputSchema, result.output);
            if (!validation.valid) {
              throw new Error(
                `Output validation failed for block '${block.id}': ${validation.errors.join("; ")}`,
              );
            }
          }

          leafOutput = result.output;
          leafUsage = result.usage;
          break;
        }

        case "decision": {
          if (!options.providers.decision) {
            throw new Error(
              `Workflow provider 'decision' is not configured for block '${block.id}'`,
            );
          }
          const renderedState =
            typeof block.state === "string"
              ? renderTemplate(block.state, ctx)
              : resolveValue(block.state, ctx);

          const renderedQuestions = resolveValue(block.questions, ctx) as Record<string, unknown>;
          renderedRequest = { state: renderedState, questions: renderedQuestions };

          const result = await options.providers.decision(
            { state: renderedState, questions: renderedQuestions },
            options.signal,
          );
          leafOutput = result.answers;
          leafUsage = result.usage;
          break;
        }

        case "search": {
          if (!options.providers.search) {
            throw new Error(`Workflow provider 'search' is not configured for block '${block.id}'`);
          }
          const renderedQuery = renderTemplate(block.query, ctx);
          renderedRequest = {
            query: renderedQuery,
            numResults: block.numResults,
            text: block.text,
            highlights: block.highlights,
          };

          const result = await options.providers.search(
            {
              query: renderedQuery,
              numResults: block.numResults,
              text: block.text,
              highlights: block.highlights,
            },
            options.signal,
          );
          leafOutput = result.results;
          leafUsage = result.usage;
          break;
        }

        case "speech": {
          if (!options.providers.speech) {
            throw new Error(`Workflow provider 'speech' is not configured for block '${block.id}'`);
          }
          const renderedTurns = block.turns.map((turn) => ({
            voice: turn.voice,
            text: renderTemplate(turn.text, ctx),
            instructions: turn.instructions ? renderTemplate(turn.instructions, ctx) : undefined,
          }));
          renderedRequest = { turns: renderedTurns };

          const result = await options.providers.speech({ turns: renderedTurns }, options.signal);
          leafOutput = result.audio;
          leafUsage = result.usage;
          break;
        }

        case "custom": {
          const handlerFn = options.providers.custom?.[block.handler];
          if (!handlerFn) {
            throw new Error(
              `Workflow custom handler '${block.handler}' is not configured for block '${block.id}'`,
            );
          }
          const rawInput =
            block.input !== undefined
              ? resolveValue(block.input, ctx)
              : ctx.item !== undefined
                ? ctx.item
                : ctx.input;
          renderedRequest = rawInput;

          const result = await handlerFn(rawInput, {
            nodeId: block.id,
            ctx,
            signal: options.signal,
          });
          leafOutput = result.output;
          leafUsage = result.usage;
          break;
        }

        default: {
          const exhaustiveCheck: never = block;
          throw new Error(
            `Unsupported leaf block type: ${(exhaustiveCheck as { type?: string }).type}`,
          );
        }
      }

      const leafEndTime = Date.now();
      const durationMs = Math.max(0, leafEndTime - leafStartTime);

      const durableEnvelope: DurableStepEnvelope = {
        output: leafOutput,
        usage: leafUsage ?? { inputTokens: 0, outputTokens: 0, cost: 0 },
        renderedRequest,
        startedAt: leafStartTime,
        finishedAt: leafEndTime,
        durationMs,
      };

      return durableEnvelope;
    });

    // Unpack the envelope into span metadata
    span.renderedRequest = envelope.renderedRequest;
    span.usage = envelope.usage ?? { inputTokens: 0, outputTokens: 0, cost: 0 };
    span.durationMs = envelope.durationMs;
    return envelope.output;
  }

  // Execute root block
  try {
    const finalOutput = await executeBlock(workflow.root, evalCtx, undefined, workflow.root.id);
    const finishTime = Date.now();

    // Copy root span properties
    Object.assign(rootSpan, {
      status: "done" as SpanStatus,
      finishedAt: finishTime,
      durationMs: Math.max(0, finishTime - startTime),
      output: finalOutput,
    });

    // Root span already rolled up usage from all descendants
    const totalUsage = rootSpan.usage ?? { inputTokens: 0, outputTokens: 0, cost: 0 };

    trace.status = "done";
    trace.finishedAt = finishTime;
    trace.durationMs = Math.max(0, finishTime - startTime);
    trace.output = finalOutput;
    trace.usage = totalUsage;

    emitEvent({
      type: "run:finish",
      runId,
      status: "done",
      durationMs: trace.durationMs,
      usage: totalUsage,
      timestamp: finishTime,
    });
    updateTrace();

    return trace;
  } catch (err: unknown) {
    const finishTime = Date.now();
    const message = err instanceof Error ? err.message : String(err);

    rootSpan.status = "error";
    rootSpan.finishedAt = finishTime;
    rootSpan.durationMs = Math.max(0, finishTime - startTime);
    rootSpan.error = message;

    trace.status = "error";
    trace.finishedAt = finishTime;
    trace.durationMs = Math.max(0, finishTime - startTime);
    trace.error = message;

    emitEvent({
      type: "run:finish",
      runId,
      status: "error",
      durationMs: trace.durationMs,
      usage: trace.usage,
      timestamp: finishTime,
    });
    updateTrace();

    throw err;
  }
}
