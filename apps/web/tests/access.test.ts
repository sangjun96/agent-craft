import { Agent } from "agents";
import { Hono } from "hono";
import { sign } from "hono/jwt";
import { afterEach, beforeAll, beforeEach, expect, test, vi } from "vite-plus/test";
import { requireAccess } from "../worker/access.ts";
import { DashboardAgent } from "../worker/agents/dashboard-agent.ts";
import type { Env } from "../worker/env.ts";
import workerApp, * as workerExports from "../worker/index.ts";

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

test("allows a request carrying a valid CF_Authorization cookie", async () => {
  const jwt = await token();
  const response = await app.request("/", { headers: { Cookie: `CF_Authorization=${jwt}` } }, env);
  expect(response.status).toBe(200);
});

test("rejects a request without the Access header or cookie", async () => {
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

test("GET /api/access reports authentication status without blocking public visitors", async () => {
  const guest = await workerApp.request("/api/access", {}, env);
  expect(guest.status).toBe(200);
  expect(await guest.json()).toEqual({ authenticated: false });

  const owner = await workerApp.request(
    "/api/access",
    { headers: { "Cf-Access-Jwt-Assertion": await token() } },
    env,
  );
  expect(owner.status).toBe(200);
  expect(await owner.json()).toEqual({ authenticated: true });
});

test("GET /api/access/login requires Access and redirects to / when authenticated", async () => {
  expect((await workerApp.request("/api/access/login", {}, env)).status).toBe(403);

  const response = await workerApp.request(
    "/api/access/login",
    { headers: { "Cf-Access-Jwt-Assertion": await token() } },
    env,
  );
  expect(response.status).toBe(302);
  expect(response.headers.get("Location")).toBe("/");
});

test.each([
  ["POST", "/api/agents/bbox-agent/run"],
  ["POST", "/api/agents/curriculum-classifier-agent/run"],
  ["POST", "/api/resources"],
  ["PATCH", "/api/resources/abc"],
  ["DELETE", "/api/resources/abc"],
  ["POST", "/agents/bbox-agent/default"],
  ["POST", "/api/unregistered-future-route"],
])("rejects unauthenticated %s %s with 403", async (method, path) => {
  const response = await workerApp.request(path, { method }, env);
  expect(response.status).toBe(403);
});

test("every exported Agent class is read-only over WebSocket and never exposes run as @callable", () => {
  const agentClasses = Object.entries(workerExports).filter(
    ([, exported]) => typeof exported === "function" && exported.prototype instanceof Agent,
  );
  expect(agentClasses.length).toBeGreaterThan(0);

  for (const [name, AgentClass] of agentClasses) {
    const prototype = (AgentClass as { prototype: DashboardAgent }).prototype;
    const instance = Object.create(prototype) as DashboardAgent;
    expect(instance, `${name} must extend DashboardAgent`).toBeInstanceOf(DashboardAgent);
    expect(
      instance.shouldConnectionBeReadonly(),
      `${name} must keep WebSocket connections read-only`,
    ).toBe(true);

    const callables = [...instance.getCallableMethods().keys()].sort();
    expect(callables, `${name} must only expose read-only query methods via @callable()`).toEqual([
      "getRun",
      "listRuns",
    ]);
  }
});
