import { describe, expect, it, vi } from "vite-plus/test";
import * as z from "zod";
import {
  block,
  definePrompt,
  defineWorkflow,
  fromZod,
  runWorkflow,
  type DurableStepEnvelope,
  type WorkflowStepConfig,
  type WorkflowStepRunner,
} from "../src/index.js";

describe("workflow runner engine", () => {
  it("runs the exam twin question pipeline end-to-end", async () => {
    let extractCalls = 0;
    const twinCalls: string[] = [];

    const workflow = defineWorkflow({
      id: "exam-twin-generator",
      name: "시험지 문항 추출 및 쌍둥이 문항 생성",
      version: 1,
      prompts: [
        definePrompt({
          id: "extract-questions",
          version: "v1",
          model: "google/gemini-3.8-flash",
          prompt: "시험지 이미지에서 문항들을 추출해줘: {{input.image}}",
          outputSchema: fromZod(
            z.object({
              questions: z.array(z.object({ number: z.string(), content: z.string() })),
            }),
          ),
        }),
        definePrompt({
          id: "generate-twin",
          version: "v1",
          model: "google/gemini-3.8-flash",
          prompt: "문항 {{item.number}}번 쌍둥이 문항 생성: {{item.content}}",
          outputSchema: fromZod(
            z.object({
              number: z.string(),
              twinQuestion: z.string(),
              answer: z.string(),
            }),
          ),
        }),
      ],
      root: block.sequence({
        id: "main",
        steps: [
          block.llm({
            id: "extract",
            label: "문항 추출",
            ref: "extract-questions@v1",
            retry: { maxAttempts: 3, backoffMs: 10, backoff: "exponential" },
          }),
          block.map({
            id: "generate-twins",
            label: "문항별 쌍둥이 생성",
            items: "$.steps.extract.questions",
            concurrency: 2,
            onError: "continue",
            step: block.llm({
              id: "twin-item",
              label: "쌍둥이 문항 생성",
              ref: "generate-twin@v1",
            }),
          }),
        ],
      }),
    });

    const trace = await runWorkflow(workflow, {
      input: { image: "https://example.com/exam1.png" },
      providers: {
        llm: async (req) => {
          if (String(req.prompt).includes("시험지 이미지에서 문항들을 추출해줘")) {
            extractCalls++;
            return {
              output: {
                questions: [
                  { number: "1", content: "2x + 1 = 5" },
                  { number: "2", content: "3x - 2 = 7" },
                ],
              },
              usage: { inputTokens: 100, outputTokens: 50, cost: 0.00015 },
            };
          }

          const match = String(req.prompt).match(/문항 (\d+)번/);
          const num = match ? match[1] : "0";
          twinCalls.push(num);

          return {
            output: {
              number: num,
              twinQuestion: `Twin of Q${num}`,
              answer: `Answer of Q${num}`,
            },
            usage: { inputTokens: 80, outputTokens: 40, cost: 0.0001 },
          };
        },
      },
    });

    expect(extractCalls).toBe(1);
    expect(twinCalls).toHaveLength(2);
    expect(trace.status).toBe("done");
    expect(trace.usage.inputTokens).toBe(100 + 80 * 2);
    expect(trace.usage.outputTokens).toBe(50 + 40 * 2);
    expect(trace.usage.cost).toBeCloseTo(0.00015 + 0.0001 * 2, 5);

    expect(trace.stepOutputs.extract).toBeDefined();
    expect(trace.stepOutputs["generate-twins"]).toEqual([
      { number: "1", twinQuestion: "Twin of Q1", answer: "Answer of Q1" },
      { number: "2", twinQuestion: "Twin of Q2", answer: "Answer of Q2" },
    ]);
  });

  it("integrates with Cloudflare WorkflowStep runner and restores durable trace envelope", async () => {
    const invokedStepKeys: string[] = [];
    const passedConfigs: Record<string, WorkflowStepConfig> = {};

    const mockCloudflareStep: WorkflowStepRunner = {
      async do<T>(
        name: string,
        configOrCallback: WorkflowStepConfig | (() => Promise<T>),
        maybeCallback?: () => Promise<T>,
      ): Promise<T> {
        invokedStepKeys.push(name);
        const config = typeof configOrCallback === "function" ? undefined : configOrCallback;
        const callback = typeof configOrCallback === "function" ? configOrCallback : maybeCallback;
        if (config) {
          passedConfigs[name] = config;
        }

        // Simulate Cloudflare returning a previously persisted DurableStepEnvelope for "extract"
        if (name.includes("extract@v1")) {
          const persistedEnvelope: DurableStepEnvelope = {
            output: { value: "restored from durable storage" },
            usage: { inputTokens: 500, outputTokens: 250, cost: 0.0005 },
            renderedRequest: { prompt: "persisted rendered prompt" },
            startedAt: 1000,
            finishedAt: 1500,
            durationMs: 500,
          };
          return persistedEnvelope as T;
        }

        return callback!();
      },
    };

    const llmProviderSpy = vi.fn().mockResolvedValue({
      output: { value: "live output" },
      usage: { inputTokens: 10, outputTokens: 10, cost: 0.00001 },
    });

    const workflow = defineWorkflow({
      id: "cf-test",
      name: "Cloudflare Step Test",
      version: "1.0",
      root: block.sequence({
        id: "seq",
        steps: [
          block.llm({
            id: "extract",
            prompt: "Do something",
            retry: { maxAttempts: 4, backoffMs: 200, backoff: "exponential" },
            timeoutMs: 5000,
          }),
        ],
      }),
    });

    const trace = await runWorkflow(workflow, {
      input: {},
      step: mockCloudflareStep,
      providers: {
        llm: llmProviderSpy,
      },
    });

    // Verify stepKey and retry/timeout configs
    expect(invokedStepKeys).toHaveLength(1);
    expect(invokedStepKeys[0]).toMatch(/^seq\/extract@v1#[0-9a-f]{8}$/);

    const stepConfig = passedConfigs[invokedStepKeys[0]];
    expect(stepConfig).toBeDefined();
    expect(stepConfig.retries?.limit).toBe(3); // maxAttempts - 1
    expect(stepConfig.retries?.delay).toBe("200 millisecond");
    expect(stepConfig.retries?.backoff).toBe("exponential");
    expect(stepConfig.timeout).toBe("5000 millisecond");

    // LLM provider was NOT called because Cloudflare step returned persisted envelope
    expect(llmProviderSpy).not.toHaveBeenCalled();

    // Verify trace restored all metadata perfectly from envelope
    expect(trace.status).toBe("done");
    expect(trace.usage.inputTokens).toBe(500);
    expect(trace.usage.outputTokens).toBe(250);
    expect(trace.usage.cost).toBe(0.0005);
    const extractSpan = trace.rootSpan.children[0];
    expect(extractSpan.output).toEqual({ value: "restored from durable storage" });
    expect(extractSpan.renderedRequest).toEqual({ prompt: "persisted rendered prompt" });
  });

  it("handles conditional branching and records skipped span", async () => {
    const workflow = defineWorkflow({
      id: "branch-test",
      name: "Branch Test",
      version: 1,
      root: block.if({
        id: "check-mode",
        condition: { var: "$.input.mode", eq: "advanced" },
        // oxlint-disable-next-line unicorn/no-thenable
        then: block.transform({
          id: "advanced-node",
          value: { mode: "advanced-executed" },
        }),
        else: block.transform({
          id: "basic-node",
          value: { mode: "basic-executed" },
        }),
      }),
    });

    // Run with mode: "basic"
    const traceBasic = await runWorkflow(workflow, {
      input: { mode: "basic" },
      providers: {},
    });

    expect(traceBasic.output).toEqual({ mode: "basic-executed" });
    const thenSpan = traceBasic.rootSpan.children.find((c) => c.nodeId === "advanced-node");
    const elseSpan = traceBasic.rootSpan.children.find((c) => c.nodeId === "basic-node");
    expect(thenSpan?.status).toBe("skipped");
    expect(elseSpan?.status).toBe("done");

    // Run with mode: "advanced"
    const traceAdv = await runWorkflow(workflow, {
      input: { mode: "advanced" },
      providers: {},
    });
    expect(traceAdv.output).toEqual({ mode: "advanced-executed" });
    const thenSpanAdv = traceAdv.rootSpan.children.find((c) => c.nodeId === "advanced-node");
    const elseSpanAdv = traceAdv.rootSpan.children.find((c) => c.nodeId === "basic-node");
    expect(thenSpanAdv?.status).toBe("done");
    expect(elseSpanAdv?.status).toBe("skipped");
  });

  it("isolates errors when onError: continue is configured in map", async () => {
    const workflow = defineWorkflow({
      id: "error-isolation-test",
      name: "Error Isolation",
      version: 1,
      root: block.map({
        id: "items-map",
        items: "$.input.numbers",
        concurrency: 2,
        onError: "continue",
        step: block.custom({
          id: "process-item",
          handler: "divide",
        }),
      }),
    });

    const trace = await runWorkflow(workflow, {
      input: { numbers: [10, 0, 5] },
      providers: {
        custom: {
          divide: async (num) => {
            if (num === 0) {
              throw new Error("Division by zero");
            }
            return { output: 100 / Number(num) };
          },
        },
      },
    });

    expect(trace.status).toBe("done");
    expect(trace.output).toEqual([10, undefined, 20]);
    const mapSpan = trace.rootSpan;
    expect(mapSpan.children[0].status).toBe("done");
    expect(mapSpan.children[1].status).toBe("error");
    expect(mapSpan.children[1].error).toBe("Division by zero");
    expect(mapSpan.children[2].status).toBe("done");
  });

  it("retries transient failures in InMemoryStepRunner", async () => {
    let attempts = 0;

    const workflow = defineWorkflow({
      id: "retry-test",
      name: "Retry Test",
      version: 1,
      root: block.custom({
        id: "flaky-node",
        handler: "flaky",
        retry: { maxAttempts: 3, backoffMs: 5, backoff: "constant" },
      }),
    });

    const trace = await runWorkflow(workflow, {
      input: {},
      providers: {
        custom: {
          flaky: async () => {
            attempts++;
            if (attempts < 3) {
              throw new Error(`Temporary network fail attempt ${attempts}`);
            }
            return { output: "success after retries" };
          },
        },
      },
    });

    expect(attempts).toBe(3);
    expect(trace.status).toBe("done");
    expect(trace.output).toBe("success after retries");
  });

  it("performs partial re-run by reusing cached intermediate results from previousTrace", async () => {
    let extractCalls = 0;
    let twinV1Calls = 0;
    let twinV2Calls = 0;

    const promptExtract = definePrompt({
      id: "extract",
      version: "v1",
      prompt: "Extract questions from {{input.image}}",
    });

    const promptTwinV1 = definePrompt({
      id: "twin",
      version: "v1",
      prompt: "Twin v1 for {{item.number}}",
    });

    const promptTwinV2 = definePrompt({
      id: "twin",
      version: "v2",
      prompt: "Twin v2 (improved) for {{item.number}}",
    });

    const makeWorkflow = (twinRef: string) =>
      defineWorkflow({
        id: "replay-workflow",
        name: "Replay Test",
        version: 1,
        prompts: [promptExtract, promptTwinV1, promptTwinV2],
        root: block.sequence({
          id: "seq",
          steps: [
            block.llm({
              id: "extract",
              ref: "extract@v1",
            }),
            block.map({
              id: "generate-twins",
              items: "$.steps.extract.questions",
              concurrency: 2,
              step: block.llm({
                id: "twin-item",
                ref: twinRef,
              }),
            }),
          ],
        }),
      });

    const providers = {
      llm: async (req: { prompt: unknown }) => {
        const str = String(req.prompt);
        if (str.startsWith("Extract")) {
          extractCalls++;
          return {
            output: { questions: [{ number: "1" }, { number: "2" }] },
            usage: { inputTokens: 100, outputTokens: 50, cost: 0.001 },
          };
        }
        if (str.includes("Twin v1")) {
          twinV1Calls++;
          return {
            output: { twin: "v1 result" },
            usage: { inputTokens: 50, outputTokens: 25, cost: 0.0005 },
          };
        }
        if (str.includes("Twin v2")) {
          twinV2Calls++;
          return {
            output: { twin: "v2 result" },
            usage: { inputTokens: 55, outputTokens: 30, cost: 0.0006 },
          };
        }
        throw new Error("Unexpected prompt: " + str);
      },
    };

    // Run 1: initial run with v1
    const trace1 = await runWorkflow(makeWorkflow("twin@v1"), {
      input: { image: "exam.png" },
      providers,
    });

    expect(extractCalls).toBe(1);
    expect(twinV1Calls).toBe(2);
    expect(trace1.status).toBe("done");

    // Run 2: partial re-run with v2, reusing trace1
    // The `extract` block config & input are unchanged -> should be CACHED, 0 LLM calls!
    // The `twin-item` block config changed to v2 -> should be re-executed with v2!
    const trace2 = await runWorkflow(makeWorkflow("twin@v2"), {
      input: { image: "exam.png" },
      previousTrace: trace1,
      providers,
    });

    // extract was NOT called again!
    expect(extractCalls).toBe(1);
    // twin v2 was called twice
    expect(twinV2Calls).toBe(2);

    // Check extract node span in trace2 is marked cached with 0 tokens consumed
    const extractSpan = trace2.rootSpan.children.find((c) => c.nodeId === "extract");
    expect(extractSpan?.status).toBe("cached");
    expect(extractSpan?.usage?.inputTokens).toBe(0);
    expect(extractSpan?.output).toEqual({ questions: [{ number: "1" }, { number: "2" }] });

    // Check twin items in trace2 executed fresh
    const mapSpan = trace2.rootSpan.children.find((c) => c.nodeId === "generate-twins");
    expect(mapSpan?.children[0].status).toBe("done");
    expect(mapSpan?.children[0].version).toBe("v2");
  });

  it("respects seedOutputs to inject intermediate outputs directly", async () => {
    let extractCalled = false;

    const workflow = defineWorkflow({
      id: "seed-test",
      name: "Seed Outputs Test",
      version: 1,
      root: block.sequence({
        id: "seq",
        steps: [
          block.llm({
            id: "extract",
            prompt: "Extract questions",
          }),
          block.transform({
            id: "format",
            value: "Found {{steps.extract.count}} questions",
          }),
        ],
      }),
    });

    const trace = await runWorkflow(workflow, {
      input: {},
      seedOutputs: {
        extract: { count: 42 },
      },
      providers: {
        llm: async () => {
          extractCalled = true;
          return { output: { count: 1 } };
        },
      },
    });

    expect(extractCalled).toBe(false);
    expect(trace.stepOutputs.extract).toEqual({ count: 42 });
    expect(trace.output).toBe("Found 42 questions");
    const extractSpan = trace.rootSpan.children[0];
    expect(extractSpan.status).toBe("cached");
  });
});
