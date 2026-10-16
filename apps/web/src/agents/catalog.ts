import type { ComponentType } from "react";
import { BboxResultView } from "./bbox/bbox-result-view.tsx";
import { BboxRunForm } from "./bbox/bbox-run-form.tsx";
import { CurriculumResultView } from "./curriculum/curriculum-result-view.tsx";
import { CurriculumRunForm } from "./curriculum/curriculum-run-form.tsx";
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
  {
    slug: "curriculum-classifier-agent",
    title: "수학 커리큘럼 분류",
    description:
      "시험지 이미지의 문항을 System One(Jev)으로 대단원부터 세부유형까지 단계적으로 분류합니다.",
    RunForm: CurriculumRunForm,
    ResultView: CurriculumResultView,
  },
];
