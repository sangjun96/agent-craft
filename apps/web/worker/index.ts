import { routeAgentRequest } from "agents";
import { handleApi } from "./api.ts";
import type { Env } from "./env.ts";

export { BboxAgent } from "./agents/bbox-agent.ts";

export default {
  async fetch(request, env) {
    return (await routeAgentRequest(request, env)) ?? handleApi(request);
  },
} satisfies ExportedHandler<Env>;
