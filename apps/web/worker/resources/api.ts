import { createLlm } from "ai-services/llm";
import { desc, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { Hono } from "hono";
import { validator } from "hono/validator";
import * as z from "zod";
import { resources as resourcesTable } from "../db/schema.ts";
import type { Env } from "../env.ts";
import { NAMING_PROMPT, toBase64, toFileName, validateUpload } from "./resources.ts";
import type { Resource } from "./types.ts";

export const resources = new Hono<{ Bindings: Env }>()
  .get("/", async (c) => {
    const rows = await drizzle(c.env.DB)
      .select()
      .from(resourcesTable)
      .orderBy(desc(resourcesTable.createdAt));
    return c.json(rows);
  })
  .post(
    "/",
    // Validated here so the typed client knows the form takes a `file`.
    validator("form", (value, c) => {
      const { file } = value;
      if (!(file instanceof File)) return c.json({ error: "file 필드에 이미지를 첨부하세요" }, 400);
      const invalid = validateUpload(file);
      if (invalid) return c.json({ error: invalid }, 400);
      return { file };
    }),
    async (c) => {
      const { file } = c.req.valid("form");
      const bytes = new Uint8Array(await file.arrayBuffer());
      const resource: Resource = {
        id: crypto.randomUUID(),
        name: (await suggestName(c.env, file.type, bytes)) ?? file.name,
        originalName: file.name,
        contentType: file.type,
        size: file.size,
        createdAt: Date.now(),
      };
      await c.env.RESOURCES.put(objectKey(resource.id), bytes, {
        httpMetadata: { contentType: file.type },
      });
      await drizzle(c.env.DB).insert(resourcesTable).values(resource);
      return c.json(resource, 201);
    },
  )
  .get("/:id/file", async (c) => {
    const object = await c.env.RESOURCES.get(objectKey(c.req.param("id")));
    if (!object) return c.notFound();
    const headers = new Headers({ "Cache-Control": "private, max-age=3600" });
    object.writeHttpMetadata(headers);
    return new Response(object.body, { headers });
  })
  .patch(
    "/:id",
    validator("json", (value, c) => {
      const name = typeof value.name === "string" ? value.name.trim() : "";
      if (!name) return c.json({ error: "이름을 입력하세요" }, 400);
      return { name };
    }),
    async (c) => {
      const resource = await drizzle(c.env.DB)
        .update(resourcesTable)
        .set({ name: c.req.valid("json").name })
        .where(eq(resourcesTable.id, c.req.param("id")))
        .returning()
        .get();
      return resource ? c.json(resource) : c.json({ error: "리소스를 찾을 수 없습니다" }, 404);
    },
  )
  .delete("/:id", async (c) => {
    const id = c.req.param("id");
    await drizzle(c.env.DB).delete(resourcesTable).where(eq(resourcesTable.id, id));
    await c.env.RESOURCES.delete(objectKey(id));
    return c.body(null, 204);
  });

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

function objectKey(id: string): string {
  return `resources/${id}`;
}
