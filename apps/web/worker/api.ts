import { Hono } from "hono";
import type { Env } from "./env.ts";
import { resources } from "./resources/api.ts";

export const api = new Hono<{ Bindings: Env }>().route("/resources", resources);
