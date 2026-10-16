import type { BboxAgent } from "./agents/bbox-agent.ts";

export interface Env {
  BboxAgent: DurableObjectNamespace<BboxAgent>;
  OPENROUTER_API_KEY: string;
}
