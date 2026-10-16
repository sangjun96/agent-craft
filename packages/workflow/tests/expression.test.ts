import { describe, expect, it } from "vite-plus/test";
import * as z from "zod";
import {
  evaluateCondition,
  fromZod,
  renderTemplate,
  resolvePath,
  resolveValue,
  validateJsonSchema,
  type EvalContext,
} from "../src/index.js";

describe("expression and template evaluator", () => {
  const ctx: EvalContext = {
    input: {
      image: "https://example.com/exam.png",
      subject: "Math",
      count: 2,
    },
    steps: {
      extract: {
        questions: [
          { number: "1", content: "Solve 2x + 3 = 7" },
          { number: "2", content: "Find the derivative of x^2" },
        ],
      },
    },
    item: {
      number: "1",
      content: "Solve 2x + 3 = 7",
    },
    index: 0,
  };

  it("resolves paths with dot notation and array indexing", () => {
    expect(resolvePath("$.input.image", ctx)).toBe("https://example.com/exam.png");
    expect(resolvePath("$.input.count", ctx)).toBe(2);
    expect(resolvePath("$.steps.extract.questions.length", ctx)).toBe(2);
    expect(resolvePath("$.steps.extract.questions[0].number", ctx)).toBe("1");
    expect(resolvePath("$.steps.extract.questions[1].content", ctx)).toBe(
      "Find the derivative of x^2",
    );
    expect(resolvePath("$.item.number", ctx)).toBe("1");
    expect(resolvePath("$.index", ctx)).toBe(0);
  });

  it("renders string templates with interpolation", () => {
    const template = "문항 {{item.number}}번 (과목: {{input.subject}}): {{item.content}}";
    const rendered = renderTemplate(template, ctx);
    expect(rendered).toBe("문항 1번 (과목: Math): Solve 2x + 3 = 7");
  });

  it("resolves raw values preserving rich types", () => {
    // Single path expression preserves raw Array type
    const questionsRaw = resolveValue("$.steps.extract.questions", ctx);
    expect(Array.isArray(questionsRaw)).toBe(true);
    expect((questionsRaw as Array<{ number: string }>).length).toBe(2);

    // Single template wrapper preserves raw number type
    const countRaw = resolveValue("{{input.count}}", ctx);
    expect(countRaw).toBe(2);

    // Nested object data binding
    const binding = {
      firstQuestion: "$.steps.extract.questions[0]",
      total: "{{input.count}}",
      label: "Question {{item.number}}",
    };
    const resolvedObj = resolveValue(binding, ctx) as Record<string, unknown>;
    expect(resolvedObj.firstQuestion).toEqual({ number: "1", content: "Solve 2x + 3 = 7" });
    expect(resolvedObj.total).toBe(2);
    expect(resolvedObj.label).toBe("Question 1");
  });

  it("evaluates condition expressions with comparison operators", () => {
    expect(evaluateCondition({ var: "$.input.count", eq: 2 }, ctx)).toBe(true);
    expect(evaluateCondition({ var: "$.input.count", gt: 1 }, ctx)).toBe(true);
    expect(evaluateCondition({ var: "$.input.count", lt: 5 }, ctx)).toBe(true);
    expect(evaluateCondition({ var: "$.input.subject", in: ["Math", "Science"] }, ctx)).toBe(true);
    expect(evaluateCondition({ var: "$.input.subject", in: ["English", "History"] }, ctx)).toBe(
      false,
    );
    expect(evaluateCondition({ var: "$.input.subject", contains: "at" }, ctx)).toBe(true);
    expect(evaluateCondition({ var: "$.input.missing", exists: false }, ctx)).toBe(true);
    expect(evaluateCondition({ var: "$.input.image", exists: true }, ctx)).toBe(true);
  });

  it("evaluates logical condition expressions (and, or, not)", () => {
    expect(
      evaluateCondition(
        {
          and: [
            { var: "$.input.count", gte: 2 },
            { var: "$.input.subject", eq: "Math" },
          ],
        },
        ctx,
      ),
    ).toBe(true);

    expect(
      evaluateCondition(
        {
          or: [
            { var: "$.input.count", gt: 10 },
            { var: "$.input.subject", eq: "Math" },
          ],
        },
        ctx,
      ),
    ).toBe(true);

    expect(
      evaluateCondition(
        {
          not: { var: "$.input.subject", eq: "English" },
        },
        ctx,
      ),
    ).toBe(true);
  });

  it("validates data against JSON Schema and converts from Zod", () => {
    const questionSchema = z.object({
      number: z.string(),
      content: z.string(),
      difficulty: z.enum(["easy", "medium", "hard"]).optional(),
    });

    const jsonSchema = fromZod(questionSchema);

    const validData = { number: "1", content: "Solve x + 1 = 2", difficulty: "easy" };
    const invalidData = { number: 123, content: true };

    const validResult = validateJsonSchema(jsonSchema, validData);
    expect(validResult.valid).toBe(true);
    expect(validResult.errors).toHaveLength(0);

    const invalidResult = validateJsonSchema(jsonSchema, invalidData);
    expect(invalidResult.valid).toBe(false);
    expect(invalidResult.errors.length).toBeGreaterThan(0);
  });
});
