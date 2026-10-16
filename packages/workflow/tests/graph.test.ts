import { describe, expect, it } from "vite-plus/test";
import { block, defineWorkflow, runWorkflow, toGraph, type WorkflowTrace } from "../src/index.js";

describe("graph projection toGraph", () => {
  const workflow = defineWorkflow({
    id: "exam-graph-test",
    name: "Exam Graph Test",
    version: 1,
    root: block.sequence({
      id: "main-seq",
      steps: [
        block.llm({
          id: "extract",
          label: "Extract Questions",
          prompt: "Extract questions",
        }),
        block.if({
          id: "check-valid",
          label: "Check Validity",
          condition: { var: "$.steps.extract.valid", eq: true },
          // oxlint-disable-next-line unicorn/no-thenable
          then: block.map({
            id: "twins-map",
            label: "Generate Twins",
            items: "$.steps.extract.questions",
            step: block.llm({
              id: "twin-item",
              label: "Twin Question",
              prompt: "Generate twin for {{item}}",
            }),
          }),
          else: block.transform({
            id: "fallback",
            label: "Fallback Handling",
            value: { error: "Invalid questions" },
          }),
        }),
      ],
    }),
  });

  it("converts AST definition to graph nodes and edges without trace", () => {
    const graph = toGraph(workflow);

    expect(graph.nodes.length).toBeGreaterThan(0);
    expect(graph.edges.length).toBeGreaterThan(0);

    const extractNode = graph.nodes.find((n) => n.id === "extract");
    expect(extractNode).toBeDefined();
    expect(extractNode?.label).toBe("Extract Questions");
    expect(extractNode?.status).toBe("pending");

    const ifNode = graph.nodes.find((n) => n.id === "check-valid");
    expect(ifNode).toBeDefined();

    // Check branching edges
    const thenEdge = graph.edges.find(
      (e) => e.source === "check-valid" && e.target === "twins-map",
    );
    expect(thenEdge?.type).toBe("then");
    expect(thenEdge?.label).toBe("true");

    const elseEdge = graph.edges.find((e) => e.source === "check-valid" && e.target === "fallback");
    expect(elseEdge?.type).toBe("else");
    expect(elseEdge?.label).toBe("false");
  });

  it("decorates graph nodes with runtime execution trace metadata", async () => {
    const trace: WorkflowTrace = await runWorkflow(workflow, {
      input: {},
      providers: {
        llm: async (req) => {
          if (String(req.prompt) === "Extract questions") {
            return {
              output: { valid: true, questions: ["Q1", "Q2"] },
              usage: { inputTokens: 50, outputTokens: 25, cost: 0.0001 },
            };
          }
          return {
            output: { twin: "Twin created" },
            usage: { inputTokens: 20, outputTokens: 10, cost: 0.00005 },
          };
        },
      },
    });

    const graph = toGraph(workflow, trace);

    const extractNode = graph.nodes.find((n) => n.id === "extract");
    expect(extractNode?.status).toBe("done");
    expect(extractNode?.usage?.inputTokens).toBe(50);
    expect(extractNode?.output).toEqual({ valid: true, questions: ["Q1", "Q2"] });

    const fallbackNode = graph.nodes.find((n) => n.id === "fallback");
    expect(fallbackNode?.status).toBe("skipped");
  });

  it("expands map iterations into individual visual nodes when expandIterations is true", async () => {
    const trace = await runWorkflow(workflow, {
      input: {},
      providers: {
        llm: async (req) => {
          if (String(req.prompt) === "Extract questions") {
            return {
              output: { valid: true, questions: ["Q1", "Q2", "Q3"] },
              usage: { inputTokens: 50, outputTokens: 25, cost: 0.0001 },
            };
          }
          return {
            output: { twin: "Twin" },
            usage: { inputTokens: 10, outputTokens: 5, cost: 0.00002 },
          };
        },
      },
    });

    const graphExpanded = toGraph(workflow, trace, { expandIterations: true });

    // Should contain expanded iteration nodes: "twin-item[0]", "twin-item[1]", "twin-item[2]"
    const iterNode0 = graphExpanded.nodes.find((n) => n.id === "twin-item[0]");
    const iterNode1 = graphExpanded.nodes.find((n) => n.id === "twin-item[1]");
    const iterNode2 = graphExpanded.nodes.find((n) => n.id === "twin-item[2]");

    expect(iterNode0).toBeDefined();
    expect(iterNode1).toBeDefined();
    expect(iterNode2).toBeDefined();
    expect(iterNode0?.status).toBe("done");

    // Check iteration edges
    const iterEdges = graphExpanded.edges.filter((e) => e.type === "iteration");
    expect(iterEdges).toHaveLength(3);
    expect(iterEdges[0].label).toBe("#0");
  });
});
