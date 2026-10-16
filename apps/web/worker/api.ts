import { Hono } from "hono";
import { access, requireWriteAccess } from "./access.ts";
import { agents } from "./agents/api.ts";
import type { Env } from "./env.ts";
import { resources } from "./resources/api.ts";

export const api = new Hono<{ Bindings: Env }>()
  .use("*", requireWriteAccess)
  .route("/access", access)
  .route("/agents", agents)
  .route("/resources", resources);
