import type { ComponentType } from "react";
import { BboxResultView } from "./bbox/bbox-result-view.tsx";
import { BboxRunForm } from "./bbox/bbox-run-form.tsx";
import type { DashboardAgent } from "./use-dashboard-agent.ts";

export type RunFormProps = { agent: DashboardAgent; onSubmitted?: (runId: string) => void };
export type ResultViewProps = { agent: DashboardAgent; runId: string };

export type AgentDefinition = {
  /** Kebab-case Agent class name, as routed at /agents/{slug}/default. */
  slug: string;
  title: string;
  description: string;
  RunForm: ComponentType<RunFormProps>;
  ResultView: ComponentType<ResultViewProps>;
};

export const AGENTS: AgentDefinition[] = [
  {
    slug: "bbox-agent",
    title: "System One BBox",
    description: "이미지에서 설명한 대상을 System One(Jev)으로 찾아 bbox로 표시합니다.",
    RunForm: BboxRunForm,
    ResultView: BboxResultView,
  },
];
