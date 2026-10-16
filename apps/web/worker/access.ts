import { createMiddleware } from "hono/factory";
import { Jwt } from "hono/utils/jwt";
import type { Env } from "./env.ts";

// Cloudflare Access signs its JWTs with RS256. The JWKS rotates, so it is fetched, never hard-coded.
const ALGORITHMS = ["RS256" as const];

/** Rejects requests that did not pass through Cloudflare Access for this application. */
export const requireAccess = createMiddleware<{ Bindings: Env }>(async (c, next) => {
  // Local dev has no Cloudflare Access in front of it, so no Cf-Access-Jwt-Assertion header exists.
  if (import.meta.env.DEV) return next();

  const { TEAM_DOMAIN, POLICY_AUD } = c.env;
  const token = c.req.header("Cf-Access-Jwt-Assertion");
  if (!TEAM_DOMAIN || !POLICY_AUD || !token) return c.text("Forbidden", 403);

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
  } catch {
    return c.text("Forbidden", 403);
  }
  await next();
});
