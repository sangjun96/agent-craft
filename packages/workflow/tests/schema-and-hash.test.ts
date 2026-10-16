import { describe, expect, it } from "vite-plus/test";
import {
  canonicalJson,
  computeConfigHash,
  computeHash,
  computeInputHash,
  definePrompt,
  parsePromptRef,
  parseWorkflow,
  resolvePromptTemplate,
  type LlmBlock,
  type WorkflowDefinition,
} from "../src/index.js";

describe("schema and hash", () => {
  it("parses a valid workflow definition with prompts and blocks", () => {
    const rawDef: WorkflowDefinition = {
      id: "test-pipeline",
      name: "Test Pipeline",
      version: 1,
      prompts: [
        {
          id: "extract-prompt",
          version: "v1",
          model: "google/gemini-3.8-flash",
          prompt: "Extract questions from image",
        },
      ],
      root: {
        type: "sequence",
        id: "seq-root",
        steps: [
          {
            type: "llm",
            id: "extract-step",
            ref: "extract-prompt@v1",
            retry: { maxAttempts: 3, backoffMs: 500, backoff: "exponential" },
          },
          {
            type: "transform",
            id: "transform-step",
            value: "$.steps.extract-step",
          },
        ],
      },
    };

    const parsed = parseWorkflow(rawDef);
    expect(parsed.id).toBe("test-pipeline");
    expect(parsed.root.type).toBe("sequence");
  });

  it("rejects an invalid workflow definition", () => {
    const invalidDef = {
      id: "bad-workflow",
      name: "Bad",
      version: 1,
      root: {
        type: "llm",
        id: "bad-llm",
        // Missing both `ref` and `prompt`
      },
    };

    expect(() => parseWorkflow(invalidDef)).toThrow();
  });

  it("parses prompt references and resolves from registry", () => {
    expect(parsePromptRef("extract@v2")).toEqual({ id: "extract", version: "v2" });
    expect(parsePromptRef("summary")).toEqual({ id: "summary" });

    const prompt1 = definePrompt({
      id: "summarize",
      version: "v1",
      prompt: "Summarize this: {{item}}",
    });

    const prompt2 = definePrompt({
      id: "summarize",
      version: "v2",
      prompt: "Summarize briefly: {{item}}",
    });

    const resolvedV1 = resolvePromptTemplate("summarize@v1", [[prompt1, prompt2]]);
    expect(resolvedV1.prompt).toBe("Summarize this: {{item}}");

    const resolvedV2 = resolvePromptTemplate("summarize@v2", [[prompt1, prompt2]]);
    expect(resolvedV2.prompt).toBe("Summarize briefly: {{item}}");

    expect(() => resolvePromptTemplate("unknown@v1", [[prompt1]])).toThrow(
      /Prompt reference not found/,
    );
  });

  it("canonicalJson sorts keys alphabetically and formats primitives deterministically", () => {
    const objA = { z: 10, a: "hello", m: [1, 2, { b: 2, a: 1 }] };
    const objB = { a: "hello", m: [1, 2, { a: 1, b: 2 }], z: 10 };

    expect(canonicalJson(objA)).toBe(canonicalJson(objB));
    expect(canonicalJson(objA)).toBe('{"a":"hello","m":[1,2,{"a":1,"b":2}],"z":10}');
  });

  it("computeHash generates deterministic SHA-256 hex string", async () => {
    const objA = { b: 2, a: 1 };
    const objB = { a: 1, b: 2 };

    const hashA = await computeHash(objA);
    const hashB = await computeHash(objB);

    expect(hashA).toBe(hashB);
    expect(hashA).toHaveLength(64);
  });

  it("computeConfigHash reflects changes in prompt template version and parameters", async () => {
    const blockA: LlmBlock = {
      type: "llm",
      id: "llm-1",
      ref: "twin@v1",
    };

    const promptV1 = definePrompt({
      id: "twin",
      version: "v1",
      prompt: "Generate twin v1",
      model: "model-a",
    });

    const promptV2 = definePrompt({
      id: "twin",
      version: "v2",
      prompt: "Generate twin v2",
      model: "model-a",
    });

    const hashV1 = await computeConfigHash(blockA, promptV1);
    const hashV2 = await computeConfigHash(blockA, promptV2);

    expect(hashV1).not.toBe(hashV2);
  });

  it("computeInputHash produces matching hashes for identical inputs", async () => {
    const inputA = { image: "data:image/png;base64,abc", metadata: { score: 100 } };
    const inputB = { metadata: { score: 100 }, image: "data:image/png;base64,abc" };

    const hashA = await computeInputHash(inputA);
    const hashB = await computeInputHash(inputB);

    expect(hashA).toBe(hashB);
  });
});
