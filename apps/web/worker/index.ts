import { routeAgentRequest } from "agents";
import { Hono } from "hono";
import { api } from "./api.ts";
import { requireWriteAccess } from "./access.ts";
import type { Env } from "./env.ts";

export { BboxAgent } from "./agents/bbox/bbox-agent.ts";
export { CurriculumClassifierAgent } from "./agents/curriculum/curriculum-agent.ts";

const app = new Hono<{ Bindings: Env }>();

app.use("*", requireWriteAccess);

// Return the agent response untouched; wrapping it would break WebSocket upgrades.
app.get("/agents/*", async (c) => (await routeAgentRequest(c.req.raw, c.env)) ?? c.notFound());
app.route("/api", api);

export default app;
