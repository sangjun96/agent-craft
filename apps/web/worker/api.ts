import type { Env } from "./env.ts";
import { handleResources } from "./resources/api.ts";

export async function handleApi(request: Request, env: Env): Promise<Response> {
  return (
    (await handleResources(request, env)) ??
    new Response(`Hello from ${new URL(request.url).pathname}`)
  );
}
