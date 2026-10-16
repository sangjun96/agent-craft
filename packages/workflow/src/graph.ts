import type { WorkflowBlock, WorkflowDefinition } from "./schema.js";
import type { NodeSpan, SpanStatus, WorkflowTrace, WorkflowUsage } from "./types.js";

export type WorkflowGraphNode = {
  id: string;
  blockId: string;
  type: WorkflowBlock["type"];
  label: string;
  version?: string | number;
  promptRef?: string;
  status?: SpanStatus;
  durationMs?: number;
  usage?: WorkflowUsage;
  input?: unknown;
  output?: unknown;
  error?: string;
  parentId?: string;
  data: Record<string, unknown>;
};

export type WorkflowGraphEdge = {
  id: string;
  source: string;
  target: string;
  label?: string;
  type?: "default" | "then" | "else" | "iteration";
};

export type WorkflowGraph = {
  nodes: WorkflowGraphNode[];
  edges: WorkflowGraphEdge[];
};

export type ToGraphOptions = {
  /**
   * If true and a trace with map iterations is provided,
   * generates individual visual nodes for each parallel map iteration item.
   */
  expandIterations?: boolean;
};

function indexSpans(rootSpan: NodeSpan | undefined): Map<string, NodeSpan> {
  const map = new Map<string, NodeSpan>();
  if (!rootSpan) return map;

  const traverse = (span: NodeSpan) => {
    // Index by span.nodeId, and also by spanId
    map.set(span.nodeId, span);
    map.set(span.spanId, span);
    if (span.iterationIndex !== undefined) {
      map.set(`${span.nodeId}[${span.iterationIndex}]`, span);
    }
    for (const child of span.children) {
      traverse(child);
    }
  };

  traverse(rootSpan);
  return map;
}

/**
 * Pure projection function converting Workflow AST + optional WorkflowTrace
 * into a renderable graph format ({ nodes, edges }) compatible with @xyflow/react.
 */
export function toGraph(
  workflow: WorkflowDefinition,
  trace?: WorkflowTrace,
  options?: ToGraphOptions,
): WorkflowGraph {
  const nodes: WorkflowGraphNode[] = [];
  const edges: WorkflowGraphEdge[] = [];
  const spanMap = indexSpans(trace?.rootSpan);
  let edgeCounter = 0;

  function addEdge(
    source: string,
    target: string,
    type: "default" | "then" | "else" | "iteration" = "default",
    label?: string,
  ) {
    edgeCounter++;
    edges.push({
      id: `e_${source}_${target}_${edgeCounter}`,
      source,
      target,
      type,
      label,
    });
  }

  function processBlock(
    block: WorkflowBlock,
    parentId?: string,
    customId?: string,
    iterationIndex?: number,
  ): string {
    const nodeId = customId ?? block.id;
    const lookupKey = iterationIndex !== undefined ? `${block.id}[${iterationIndex}]` : block.id;
    const span = spanMap.get(lookupKey) ?? spanMap.get(block.id);

    const graphNode: WorkflowGraphNode = {
      id: nodeId,
      blockId: block.id,
      type: block.type,
      label: block.label ?? block.id,
      version: block.version ?? span?.version,
      promptRef: block.type === "llm" ? block.ref : undefined,
      status: span?.status ?? "pending",
      durationMs: span?.durationMs,
      usage: span?.usage,
      input: span?.input,
      output: span?.output,
      error: span?.error,
      parentId,
      data: {
        block,
        span,
        iterationIndex,
      },
    };

    nodes.push(graphNode);

    switch (block.type) {
      case "sequence": {
        let prevChildId: string | undefined;
        for (let i = 0; i < block.steps.length; i++) {
          const step = block.steps[i];
          const childId = processBlock(step, nodeId);
          if (prevChildId) {
            addEdge(prevChildId, childId, "default");
          } else {
            addEdge(nodeId, childId, "default");
          }
          prevChildId = childId;
        }
        break;
      }

      case "map": {
        const mapSpan = span;
        const hasIterations =
          options?.expandIterations &&
          mapSpan &&
          mapSpan.children.length > 0 &&
          mapSpan.children.some((c) => c.iterationIndex !== undefined);

        if (hasIterations && mapSpan) {
          const iterationChildren = mapSpan.children.filter((c) => c.iterationIndex !== undefined);
          for (const itemSpan of iterationChildren) {
            const idx = itemSpan.iterationIndex ?? 0;
            const iterNodeId = `${block.step.id}[${idx}]`;
            processBlock(block.step, nodeId, iterNodeId, idx);
            addEdge(nodeId, iterNodeId, "iteration", `#${idx}`);
          }
        } else {
          const childId = processBlock(block.step, nodeId);
          addEdge(nodeId, childId, "default", "each");
        }
        break;
      }

      case "parallel": {
        for (const branch of block.branches) {
          const childId = processBlock(branch, nodeId);
          addEdge(nodeId, childId, "default");
        }
        break;
      }

      case "if": {
        const thenId = processBlock(block.then, nodeId);
        addEdge(nodeId, thenId, "then", "true");

        if (block.else) {
          const elseId = processBlock(block.else, nodeId);
          addEdge(nodeId, elseId, "else", "false");
        }
        break;
      }

      default:
        // Leaf action blocks have no children
        break;
    }

    return nodeId;
  }

  processBlock(workflow.root);

  return {
    nodes,
    edges,
  };
}
