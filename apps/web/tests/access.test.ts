import { Hono } from "hono";
import { sign } from "hono/jwt";
import { afterEach, beforeAll, beforeEach, expect, test, vi } from "vite-plus/test";
import { requireAccess } from "../worker/access.ts";
import type { Env } from "../worker/env.ts";

const TEAM_DOMAIN = "https://team.cloudflareaccess.com";
const POLICY_AUD = "app-aud";
const env = { TEAM_DOMAIN, POLICY_AUD } as Env;

const app = new Hono<{ Bindings: Env }>();
app.use("*", requireAccess);
app.get("/", (c) => c.text("ok"));

let privateJwk: JsonWebKey & { alg: string; kid: string };

beforeAll(async () => {
  const { publicKey, privateKey } = (await crypto.subtle.generateKey(
    {
      name: "RSASSA-PKCS1-v1_5",
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: "SHA-256",
    },
    true,
    ["sign", "verify"],
  )) as CryptoKeyPair;
  const kid = "test-key";
  const exportJwk = async (key: CryptoKey) =>
    ({
      ...((await crypto.subtle.exportKey("jwk", key)) as JsonWebKey),
      alg: "RS256",
      kid,
    }) as const;
  privateJwk = await exportJwk(privateKey);
  const publicJwk = await exportJwk(publicKey);
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => Response.json({ keys: [publicJwk] })),
  );
});

// Vitest runs with DEV=true, which skips the check; enforce it like production unless a test says otherwise.
beforeEach(() => vi.stubEnv("DEV", false));

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
});

function token(claims: { iss?: string; aud?: string; exp?: number } = {}) {
  const now = Math.floor(Date.now() / 1000);
  return sign(
    { iss: TEAM_DOMAIN, aud: POLICY_AUD, iat: now, nbf: now, exp: now + 60, ...claims },
    privateJwk,
  );
}

async function request(jwt?: string, bindings: Env = env) {
  const headers = jwt ? { "Cf-Access-Jwt-Assertion": jwt } : undefined;
  return app.request("/", { headers }, bindings);
}

test("allows a request carrying a valid Access token", async () => {
  const response = await request(await token());
  expect(response.status).toBe(200);
  expect(await response.text()).toBe("ok");
});

test("rejects a request without the Access header", async () => {
  expect((await request()).status).toBe(403);
});

test("rejects a token issued for another application", async () => {
  expect((await request(await token({ aud: "other-app" }))).status).toBe(403);
});

test("rejects a token from another issuer", async () => {
  const jwt = await token({ iss: "https://evil.cloudflareaccess.com" });
  expect((await request(jwt)).status).toBe(403);
});

test("rejects an expired token", async () => {
  const jwt = await token({ exp: Math.floor(Date.now() / 1000) - 10 });
  expect((await request(jwt)).status).toBe(403);
});

test("fails closed when the Access settings are missing", async () => {
  expect((await request(await token(), {} as Env)).status).toBe(403);
});

test("skips the check in local dev", async () => {
  vi.stubEnv("DEV", true);
  expect((await request(undefined, {} as Env)).status).toBe(200);
});
