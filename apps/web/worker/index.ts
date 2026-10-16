import { routeAgentRequest } from "agents";
import { handleApi } from "./api.ts";
import type { Env } from "./env.ts";

export { BboxAgent } from "./agents/bbox/bbox-agent.ts";

export default {
  async fetch(request, env) {
    return (await routeAgentRequest(request, env)) ?? handleApi(request, env);
  },
} satisfies ExportedHandler<Env>;
