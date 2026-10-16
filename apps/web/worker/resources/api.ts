import { createLlm } from "ai-services/llm";
import { desc, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import * as z from "zod";
import { resources } from "../db/schema.ts";
import type { Env } from "../env.ts";
import { NAMING_PROMPT, toBase64, toFileName, validateUpload } from "./resources.ts";
import type { Resource } from "./types.ts";

const ROUTE = /^\/api\/resources(?:\/([^/]+)(\/file)?)?$/;

/** Handles /api/resources/*, or returns undefined for other paths. */
export async function handleResources(request: Request, env: Env): Promise<Response | undefined> {
  const match = ROUTE.exec(new URL(request.url).pathname);
  if (!match) return undefined;
  const [, id, file] = match;
  const { method } = request;

  if (!id) {
    if (method === "GET") return listResources(env);
    if (method === "POST") return uploadResource(request, env);
  } else if (file) {
    if (method === "GET") return getFile(env, id);
  } else {
    if (method === "PATCH") return renameResource(request, env, id);
    if (method === "DELETE") return deleteResource(env, id);
  }
  return new Response("Method Not Allowed", { status: 405 });
}

async function listResources(env: Env): Promise<Response> {
  const rows = await drizzle(env.DB).select().from(resources).orderBy(desc(resources.createdAt));
  return Response.json(rows);
}

async function uploadResource(request: Request, env: Env): Promise<Response> {
  const file = (await request.formData()).get("file");
  if (!(file instanceof File)) return badRequest("file 필드에 이미지를 첨부하세요");
  const invalid = validateUpload(file);
  if (invalid) return badRequest(invalid);

  const bytes = new Uint8Array(await file.arrayBuffer());
  const resource: Resource = {
    id: crypto.randomUUID(),
    name: (await suggestName(env, file.type, bytes)) ?? file.name,
    originalName: file.name,
    contentType: file.type,
    size: file.size,
    createdAt: Date.now(),
  };
  await env.RESOURCES.put(objectKey(resource.id), bytes, {
    httpMetadata: { contentType: file.type },
  });
  await drizzle(env.DB).insert(resources).values(resource);
  return Response.json(resource, { status: 201 });
}

/** Asks the LLM for a descriptive file name; a failed suggestion must not fail the upload. */
async function suggestName(
  env: Env,
  contentType: string,
  bytes: Uint8Array,
): Promise<string | undefined> {
  try {
    const { name } = await createLlm({ apiKey: env.OPENROUTER_API_KEY }).generateObject(
      [
        { type: "text", text: NAMING_PROMPT },
        {
          type: "image_url",
          imageUrl: { url: `data:${contentType};base64,${toBase64(bytes)}` },
        },
      ],
      z.object({ name: z.string() }),
    );
    return toFileName(name, contentType);
  } catch (error) {
    console.error("Resource name suggestion failed", error);
    return undefined;
  }
}

async function getFile(env: Env, id: string): Promise<Response> {
  const object = await env.RESOURCES.get(objectKey(id));
  if (!object) return new Response("Not Found", { status: 404 });
  const headers = new Headers({ "Cache-Control": "private, max-age=3600" });
  object.writeHttpMetadata(headers);
  return new Response(object.body, { headers });
}

async function renameResource(request: Request, env: Env, id: string): Promise<Response> {
  const { name } = (await request.json()) as { name?: unknown };
  if (typeof name !== "string" || !name.trim()) return badRequest("이름을 입력하세요");
  const resource = await drizzle(env.DB)
    .update(resources)
    .set({ name: name.trim() })
    .where(eq(resources.id, id))
    .returning()
    .get();
  return resource ? Response.json(resource) : new Response("Not Found", { status: 404 });
}

async function deleteResource(env: Env, id: string): Promise<Response> {
  await drizzle(env.DB).delete(resources).where(eq(resources.id, id));
  await env.RESOURCES.delete(objectKey(id));
  return new Response(null, { status: 204 });
}

function objectKey(id: string): string {
  return `resources/${id}`;
}

function badRequest(error: string): Response {
  return Response.json({ error }, { status: 400 });
}
