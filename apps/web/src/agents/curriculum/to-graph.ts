import type { Edge, Node } from "@xyflow/react";
import { LEVELS } from "../../../worker/agents/curriculum/constants.ts";
import { questionUsage } from "../../../worker/agents/curriculum/usage.ts";
import type { CurriculumRun, QuestionTrace, Step } from "../../../worker/agents/types.ts";
import { formatCost, formatDuration } from "../format.ts";
import { layoutTree, type LayoutNode } from "./layout.ts";

/** pending: not answered yet · picked: continues · final: on the chosen path. */
export type NodeState = "pending" | "picked" | "final" | "error";

export type CurriculumNodeData = {
  kind: "root" | "question" | "option";
  title: string;
  /** Curriculum level name for option nodes. */
  level?: string;
  probability?: number;
  meta?: string;
  state: NodeState;
  [key: string]: unknown;
};

export type CurriculumFlowNode = Node<CurriculumNodeData, "curriculum">;

const SIZE = { columnWidth: 240, rowHeight: 52 };

/** Exam → question → the options followed at each level (plus those still awaiting an answer), linked from their parent. */
export function buildGraph(run: CurriculumRun): { nodes: CurriculumFlowNode[]; edges: Edge[] } {
  const nodes: CurriculumFlowNode[] = [];
  const edges: Edge[] = [];
  const rootId = "root";
  const rootLayout: LayoutNode = { id: rootId, children: [] };

  nodes.push({
    id: rootId,
    type: "curriculum",
    position: { x: 0, y: 0 },
    data: {
      kind: "root",
      title: "시험지",
      meta: run.questions.length > 0 ? `${run.questions.length}문항` : "문항 추출 중…",
      state: run.extract.status === "error" ? "error" : "final",
    },
  });

  for (const question of run.questions) {
    const questionId = `q:${question.number}`;
    const questionLayout: LayoutNode = { id: questionId, children: [] };
    rootLayout.children.push(questionLayout);
    nodes.push({
      id: questionId,
      type: "curriculum",
      position: { x: 0, y: 0 },
      data: {
        kind: "question",
        title: `${question.number}번`,
        meta: questionMeta(question),
        state:
          question.status === "error" ? "error" : question.status === "done" ? "final" : "pending",
      },
    });
    edges.push({ id: `${rootId}->${questionId}`, source: rootId, target: questionId });

    const steps = new Map(question.steps.map((step) => [JSON.stringify(step.path), step]));
    const expand = (parentId: string, parentLayout: LayoutNode, path: string[]) => {
      const step = steps.get(JSON.stringify(path));
      if (!step) return;
      for (const option of step.options) {
        const state = optionState(question, step, option.name, option.probability, path);
        // Options that were not followed stay out of the graph; those awaiting an answer still show.
        if (!state) continue;
        const optionPath = [...path, option.name];
        const id = `${questionId}:${JSON.stringify(optionPath)}`;
        const layout: LayoutNode = { id, children: [] };
        parentLayout.children.push(layout);
        nodes.push({
          id,
          type: "curriculum",
          position: { x: 0, y: 0 },
          data: {
            kind: "option",
            title: option.name,
            level: LEVELS[step.level],
            probability: option.probability,
            state,
          },
        });
        edges.push({
          id: `${parentId}->${id}`,
          source: parentId,
          target: id,
          animated: option.probability === undefined && step.status === "running",
        });
        expand(id, layout, optionPath);
      }
    };
    expand(questionId, questionLayout, []);
  }

  const positions = layoutTree(rootLayout, SIZE);
  for (const node of nodes) node.position = positions.get(node.id)!;
  return { nodes, edges };
}

function questionMeta(question: QuestionTrace): string {
  if (question.status === "running") return "분류 중…";
  if (question.status === "error") return "실패";
  return `${formatCost(questionUsage(question).cost)} · ${formatDuration(question.durationMs ?? 0)}`;
}

function optionState(
  question: QuestionTrace,
  step: Step,
  name: string,
  probability: number | undefined,
  path: string[],
): NodeState | undefined {
  const optionPath = [...path, name];
  const finalPath = question.final?.path;
  if (finalPath && optionPath.every((part, index) => finalPath[index] === part)) return "final";
  if (probability === undefined) return step.status === "error" ? "error" : "pending";
  return step.picked.includes(name) ? "picked" : undefined;
}
