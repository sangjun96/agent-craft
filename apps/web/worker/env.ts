import type { BboxAgent } from "./agents/bbox/bbox-agent.ts";
import type { CurriculumClassifierAgent } from "./agents/curriculum/curriculum-agent.ts";

export interface Env {
  BboxAgent: DurableObjectNamespace<BboxAgent>;
  CurriculumClassifierAgent: DurableObjectNamespace<CurriculumClassifierAgent>;
  DB: D1Database;
  OPENROUTER_API_KEY: string;
  RESOURCES: R2Bucket;
}
