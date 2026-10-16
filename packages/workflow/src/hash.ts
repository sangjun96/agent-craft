import type { PromptTemplate, WorkflowBlock } from "./schema.js";

/**
 * Deterministically serialize a JavaScript value to canonical JSON.
 * - Object keys are sorted alphabetically.
 * - Primitives and null are formatted consistently.
 * - undefined properties in objects are omitted; undefined in arrays becomes null.
 */
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") {
    if (typeof value === "undefined") {
      return "null";
    }
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    const items = value.map((item) => (typeof item === "undefined" ? "null" : canonicalJson(item)));
    return `[${items.join(",")}]`;
  }

  const record = value as Record<string, unknown>;
  const sortedKeys = Object.keys(record)
    .filter((key) => typeof record[key] !== "undefined")
    .sort();

  const entries = sortedKeys.map((key) => {
    return `${JSON.stringify(key)}:${canonicalJson(record[key])}`;
  });

  return `{${entries.join(",")}}`;
}

/**
 * Compute deterministic SHA-256 hex string using Web Crypto API.
 */
export async function computeHash(value: unknown): Promise<string> {
  const json = canonicalJson(value);
  const data = new TextEncoder().encode(json);
  const hashBuffer = await globalThis.crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Compute deterministic config hash for a workflow block.
 * When an LLM block references a prompt template, the template's properties
 * are merged to ensure cache invalidation if the prompt template changes.
 */
export async function computeConfigHash(
  block: WorkflowBlock,
  resolvedPrompt?: PromptTemplate,
): Promise<string> {
  let normalizedConfig: Record<string, unknown>;

  switch (block.type) {
    case "llm": {
      normalizedConfig = {
        type: "llm",
        ref: block.ref,
        version: block.version ?? resolvedPrompt?.version,
        model: block.model ?? resolvedPrompt?.model,
        prompt: block.prompt ?? resolvedPrompt?.prompt,
        outputSchema: block.outputSchema ?? resolvedPrompt?.outputSchema,
        reasoningEffort: block.reasoningEffort ?? resolvedPrompt?.reasoningEffort,
        temperature: block.temperature ?? resolvedPrompt?.temperature,
      };
      break;
    }
    case "decision": {
      normalizedConfig = {
        type: "decision",
        version: block.version,
        state: block.state,
        questions: block.questions,
      };
      break;
    }
    case "search": {
      normalizedConfig = {
        type: "search",
        version: block.version,
        query: block.query,
        numResults: block.numResults,
        text: block.text,
        highlights: block.highlights,
      };
      break;
    }
    case "speech": {
      normalizedConfig = {
        type: "speech",
        version: block.version,
        turns: block.turns,
      };
      break;
    }
    case "custom": {
      normalizedConfig = {
        type: "custom",
        version: block.version,
        handler: block.handler,
        input: block.input,
      };
      break;
    }
    case "transform": {
      normalizedConfig = {
        type: "transform",
        version: block.version,
        value: block.value,
      };
      break;
    }
    case "if": {
      normalizedConfig = {
        type: "if",
        version: block.version,
        condition: block.condition,
      };
      break;
    }
    case "map": {
      normalizedConfig = {
        type: "map",
        version: block.version,
        items: block.items,
        concurrency: block.concurrency,
        onError: block.onError,
      };
      break;
    }
    case "parallel": {
      normalizedConfig = {
        type: "parallel",
        version: block.version,
        concurrency: block.concurrency,
        onError: block.onError,
      };
      break;
    }
    case "sequence": {
      normalizedConfig = {
        type: "sequence",
        version: block.version,
      };
      break;
    }
    default: {
      const exhaustiveCheck: never = block;
      normalizedConfig = { type: (exhaustiveCheck as { type?: string }).type ?? "unknown" };
      break;
    }
  }

  return computeHash(normalizedConfig);
}

/**
 * Compute deterministic hash of evaluated input data.
 */
export async function computeInputHash(input: unknown): Promise<string> {
  return computeHash(input);
}
