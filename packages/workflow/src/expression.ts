import type { ConditionExpr, ConditionOperator } from "./schema.js";
import { canonicalJson } from "./hash.js";

export type EvalContext = {
  input?: unknown;
  steps?: Record<string, unknown>;
  item?: unknown;
  index?: number;
};

/**
 * Tokenize a path expression into segments.
 * Examples:
 *   "$.input.image" -> ["input", "image"]
 *   "steps.extract.questions[0].number" -> ["steps", "extract", "questions", 0, "number"]
 *   "item.number" -> ["item", "number"]
 *   "index" -> ["index"]
 */
function parsePathTokens(path: string): Array<string | number> {
  let cleaned = path.trim();
  if (cleaned.startsWith("$.")) {
    cleaned = cleaned.slice(2);
  } else if (cleaned.startsWith("$")) {
    cleaned = cleaned.slice(1);
    if (cleaned.startsWith(".")) {
      cleaned = cleaned.slice(1);
    }
  }

  if (cleaned === "") {
    return [];
  }

  const tokens: Array<string | number> = [];
  const regex = /([a-zA-Z0-9_-]+)|\[(\d+)\]|\[['"]([^'"]+)['"]\]/g;
  let match: RegExpExecArray | null = null;

  while ((match = regex.exec(cleaned)) !== null) {
    if (match[1] !== undefined) {
      tokens.push(match[1]);
    } else if (match[2] !== undefined) {
      tokens.push(Number.parseInt(match[2], 10));
    } else if (match[3] !== undefined) {
      tokens.push(match[3]);
    }
  }

  return tokens;
}

/**
 * Safely resolve a path against an EvalContext.
 */
export function resolvePath(path: string, ctx: EvalContext): unknown {
  const trimmed = path.trim();

  if (trimmed === "$" || trimmed === "") {
    return {
      input: ctx.input,
      steps: ctx.steps,
      item: ctx.item,
      index: ctx.index,
    };
  }

  const tokens = parsePathTokens(trimmed);
  if (tokens.length === 0) {
    return undefined;
  }

  const [first, ...rest] = tokens;
  let current: unknown;

  if (first === "input") {
    current = ctx.input;
  } else if (first === "steps") {
    current = ctx.steps;
  } else if (first === "item") {
    current = ctx.item;
  } else if (first === "index") {
    current = ctx.index;
  } else if (
    ctx.item &&
    typeof ctx.item === "object" &&
    first in (ctx.item as Record<string, unknown>)
  ) {
    current = (ctx.item as Record<string, unknown>)[first as string];
  } else if (ctx.steps && typeof first === "string" && first in ctx.steps) {
    current = ctx.steps[first];
  } else if (
    ctx.input &&
    typeof ctx.input === "object" &&
    first in (ctx.input as Record<string, unknown>)
  ) {
    current = (ctx.input as Record<string, unknown>)[first as string];
  } else {
    return undefined;
  }

  for (const token of rest) {
    if (current === null || current === undefined) {
      return undefined;
    }

    if (Array.isArray(current)) {
      if (token === "length") {
        current = current.length;
      } else if (typeof token === "number") {
        current = current[token];
      } else {
        const index = Number.parseInt(String(token), 10);
        current = Number.isNaN(index) ? undefined : current[index];
      }
    } else if (typeof current === "string" && token === "length") {
      current = current.length;
    } else if (typeof current === "object") {
      current = (current as Record<string | number, unknown>)[token];
    } else {
      return undefined;
    }
  }

  return current;
}

/**
 * Render a string template by replacing {{expression}} with resolved values.
 */
export function renderTemplate(template: string, ctx: EvalContext): string {
  return template.replace(/\{\{\s*([^}]+?)\s*\}\}/g, (_match, expr: string) => {
    const value = resolvePath(expr, ctx);
    if (value === undefined || value === null) {
      return "";
    }
    if (typeof value === "object") {
      return JSON.stringify(value);
    }
    if (typeof value === "string") {
      return value;
    }
    if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") {
      return String(value);
    }
    return JSON.stringify(value);
  });
}

/**
 * Check if a value is a plain JS object (not Array, Date, RegExp, etc.).
 */
function isPlainObject(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    Object.prototype.toString.call(value) === "[object Object]"
  );
}

/**
 * Resolve data binding values while preserving rich data types when possible.
 * - Single path or full {{expression}} returns the raw value (Array, Object, Number, etc.).
 * - Embedded {{templates}} are string interpolated.
 * - Objects and arrays are resolved recursively.
 */
export function resolveValue(value: unknown, ctx: EvalContext): unknown {
  if (typeof value === "string") {
    const trimmed = value.trim();

    // Check single path reference: "$.steps.extract.questions" or "$input.image"
    if (/^\$(?:\.[a-zA-Z0-9_-]+|\[\d+\]|\[['"][^'"]+['"]\])+$/.test(trimmed)) {
      return resolvePath(trimmed, ctx);
    }

    // Check single interpolation wrapper: "{{item.number}}" or "{{ $.steps.extract }}"
    const singleMatch = trimmed.match(/^\{\{\s*([^}]+?)\s*\}\}$/);
    if (singleMatch && singleMatch[1]) {
      return resolvePath(singleMatch[1], ctx);
    }

    // Otherwise, string template interpolation if contains {{...}}
    if (value.includes("{{") && value.includes("}}")) {
      return renderTemplate(value, ctx);
    }

    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => resolveValue(item, ctx));
  }

  if (isPlainObject(value)) {
    const result: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      result[k] = resolveValue(v, ctx);
    }
    return result;
  }

  return value;
}

/**
 * Compare two values for deep equality using canonical JSON representation.
 */
function isDeepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a === null || b === null || typeof a !== "object" || typeof b !== "object") {
    return a === b;
  }
  return canonicalJson(a) === canonicalJson(b);
}

function applyOperator(op: ConditionOperator, left: unknown, right?: unknown): boolean {
  switch (op) {
    case "eq":
      return isDeepEqual(left, right);
    case "neq":
      return !isDeepEqual(left, right);
    case "gt":
      return Number(left) > Number(right);
    case "gte":
      return Number(left) >= Number(right);
    case "lt":
      return Number(left) < Number(right);
    case "lte":
      return Number(left) <= Number(right);
    case "in": {
      if (!Array.isArray(right)) return false;
      return right.some((elem) => isDeepEqual(left, elem));
    }
    case "contains": {
      if (typeof left === "string") {
        return left.includes(String(right));
      }
      if (Array.isArray(left)) {
        return left.some((elem) => isDeepEqual(elem, right));
      }
      if (left && typeof left === "object" && typeof right === "string") {
        return right in (left as Record<string, unknown>);
      }
      return false;
    }
    case "exists": {
      const shouldExist = right !== false;
      const actualExists = left !== undefined && left !== null;
      return shouldExist ? actualExists : !actualExists;
    }
    default: {
      return false;
    }
  }
}

/**
 * Safely evaluate a ConditionExpr tree against an EvalContext without eval().
 */
export function evaluateCondition(condition: ConditionExpr, ctx: EvalContext): boolean {
  if ("and" in condition) {
    return condition.and.every((c) => evaluateCondition(c, ctx));
  }

  if ("or" in condition) {
    return condition.or.some((c) => evaluateCondition(c, ctx));
  }

  if ("not" in condition) {
    return !evaluateCondition(condition.not, ctx);
  }

  if ("op" in condition) {
    const left = resolveValue(condition.left, ctx);
    const right = condition.right !== undefined ? resolveValue(condition.right, ctx) : undefined;
    return applyOperator(condition.op, left, right);
  }

  if ("var" in condition) {
    const left = resolveValue(condition.var, ctx);

    if (condition.eq !== undefined) {
      return applyOperator("eq", left, resolveValue(condition.eq, ctx));
    }
    if (condition.neq !== undefined) {
      return applyOperator("neq", left, resolveValue(condition.neq, ctx));
    }
    if (condition.gt !== undefined) {
      return applyOperator("gt", left, resolveValue(condition.gt, ctx));
    }
    if (condition.gte !== undefined) {
      return applyOperator("gte", left, resolveValue(condition.gte, ctx));
    }
    if (condition.lt !== undefined) {
      return applyOperator("lt", left, resolveValue(condition.lt, ctx));
    }
    if (condition.lte !== undefined) {
      return applyOperator("lte", left, resolveValue(condition.lte, ctx));
    }
    if (condition.in !== undefined) {
      return applyOperator("in", left, resolveValue(condition.in, ctx));
    }
    if (condition.contains !== undefined) {
      return applyOperator("contains", left, resolveValue(condition.contains, ctx));
    }
    if (condition.exists !== undefined) {
      return applyOperator("exists", left, condition.exists);
    }
    return Boolean(left);
  }

  return false;
}
