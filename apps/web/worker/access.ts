import { Hono, type Context } from "hono";
import { getCookie } from "hono/cookie";
import { createMiddleware } from "hono/factory";
import { Jwt } from "hono/utils/jwt";
import type { Env } from "./env.ts";

// Cloudflare Access signs its JWTs with RS256. The JWKS rotates, so it is fetched, never hard-coded.
const ALGORITHMS = ["RS256" as const];
const READ_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/** Returns true when the request carries a valid Cloudflare Access token (or runs in local dev). */
export async function hasAccess(c: Context<{ Bindings: Env }>): Promise<boolean> {
  // Local dev has no Cloudflare Access in front of it, so no Access JWT exists.
  if (import.meta.env.DEV) return true;

  const { TEAM_DOMAIN, POLICY_AUD } = c.env;
  const token = c.req.header("Cf-Access-Jwt-Assertion") ?? getCookie(c, "CF_Authorization");
  if (!TEAM_DOMAIN || !POLICY_AUD || !token) return false;

  try {
    await Jwt.verifyWithJwks(
      token,
      {
        jwks_uri: `${TEAM_DOMAIN}/cdn-cgi/access/certs`,
        allowedAlgorithms: ALGORITHMS,
        verification: { iss: TEAM_DOMAIN, aud: POLICY_AUD },
      },
      { cf: { cacheEverything: true, cacheTtl: 300 } },
    );
    return true;
  } catch {
    return false;
  }
}

/** Rejects requests that did not pass through Cloudflare Access for this application. */
export const requireAccess = createMiddleware<{ Bindings: Env }>(async (c, next) => {
  if (!(await hasAccess(c))) return c.text("Forbidden", 403);
  await next();
});

/** Allows read-only requests (GET/HEAD/OPTIONS) publicly and requires Cloudflare Access for all writes. */
export const requireWriteAccess = createMiddleware<{ Bindings: Env }>(async (c, next) => {
  if (!READ_METHODS.has(c.req.method) && !(await hasAccess(c))) {
    return c.text("Forbidden", 403);
  }
  await next();
});

export const access = new Hono<{ Bindings: Env }>()
  .get("/", async (c) => c.json({ authenticated: await hasAccess(c) }))
  .get("/login", requireAccess, (c) => c.redirect("/"));
