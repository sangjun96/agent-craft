import type { BboxAgent } from "./agents/bbox/bbox-agent.ts";

export interface Env {
  BboxAgent: DurableObjectNamespace<BboxAgent>;
  DB: D1Database;
  OPENROUTER_API_KEY: string;
  RESOURCES: R2Bucket;
}
