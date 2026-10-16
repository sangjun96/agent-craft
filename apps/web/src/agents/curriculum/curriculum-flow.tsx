import { useEffect, useMemo, type CSSProperties } from "react";
import {
  Background,
  Controls,
  Handle,
  Position,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  type NodeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { cn } from "cn";
import type { CurriculumRun } from "../../../worker/agents/types.ts";
import { buildGraph, type CurriculumFlowNode, type NodeState } from "./to-graph.ts";

const STATE_STYLES: Record<NodeState, string> = {
  final: "border-primary bg-primary text-primary-foreground",
  picked: "border-primary bg-card text-foreground",
  pending: "animate-pulse border-dashed border-border bg-card text-muted-foreground",
  error: "border-destructive bg-card text-destructive",
};

function CurriculumNodeView({ data }: NodeProps<CurriculumFlowNode>) {
  return (
    <div
      title={data.title}
      className={cn(
        "flex w-52 flex-col gap-0.5 rounded-md border px-2.5 py-1.5 text-xs",
        STATE_STYLES[data.state],
      )}
    >
      <Handle type="target" position={Position.Left} className="opacity-0" />
      {data.level && <span className="text-[10px] opacity-70">{data.level}</span>}
      <span className="flex items-baseline justify-between gap-2">
        <span className="truncate font-medium">{data.title}</span>
        {data.probability !== undefined && (
          <span className="shrink-0 tabular-nums">{(data.probability * 100).toFixed(0)}%</span>
        )}
      </span>
      {data.meta && <span className="text-[10px] opacity-70">{data.meta}</span>}
      <Handle type="source" position={Position.Right} className="opacity-0" />
    </div>
  );
}

// Declared outside the component so React Flow sees a stable object.
const nodeTypes = { curriculum: CurriculumNodeView };

// Theme React Flow's own chrome with the app's tokens.
const THEME = {
  "--xy-background-color": "transparent",
  "--xy-edge-stroke": "var(--muted-foreground)",
  "--xy-controls-button-background-color": "var(--card)",
  "--xy-controls-button-color": "var(--foreground)",
  "--xy-controls-button-border-color": "var(--border)",
} as CSSProperties;

/** Live decision graph of a run: every option offered at each level, with its probability and whether it was followed. */
export function CurriculumFlow({ run }: { run: CurriculumRun }) {
  return (
    <div className="h-[34rem] overflow-hidden rounded-md border" style={THEME}>
      <ReactFlowProvider>
        <Canvas run={run} />
      </ReactFlowProvider>
    </div>
  );
}

function Canvas({ run }: { run: CurriculumRun }) {
  const { nodes, edges } = useMemo(() => buildGraph(run), [run]);
  const { fitView } = useReactFlow();
  const running = run.status === "running";

  // Keep the growing graph in view while the run is live, then leave the viewport to the user.
  useEffect(() => {
    if (running) void fitView({ duration: 200 });
  }, [running, nodes.length, fitView]);

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      fitView
      minZoom={0.05}
      nodesDraggable={false}
      nodesConnectable={false}
      elementsSelectable={false}
    >
      <Background />
      <Controls showInteractive={false} />
    </ReactFlow>
  );
}
