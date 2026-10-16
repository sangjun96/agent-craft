import { desc, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { Hono } from "hono";
import { validator } from "hono/validator";
import { resources as resourcesTable } from "../db/schema.ts";
import type { Env } from "../env.ts";
import { CSV_TYPE, csvShapeHash, isCsv } from "./csv.ts";
import { isImage, suggestImageName } from "./image.ts";
import type { Resource } from "./types.ts";

const MAX_SIZE = 10 * 1024 * 1024;

/** Returns why the file can't be stored, or undefined when it can. */
function validateUpload(file: { name: string; type: string; size: number }): string | undefined {
  if (!isImage(file) && !isCsv(file)) {
    return "PNG, JPEG, WEBP, GIF 이미지 또는 CSV만 업로드할 수 있습니다";
  }
  if (file.size > MAX_SIZE) return "파일이 너무 큽니다 (최대 10MB)";
}

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
      if (!(file instanceof File)) return c.json({ error: "file 필드에 파일을 첨부하세요" }, 400);
      const invalid = validateUpload(file);
      if (invalid) return c.json({ error: invalid }, 400);
      return { file };
    }),
    async (c) => {
      const { file } = c.req.valid("form");
      const bytes = new Uint8Array(await file.arrayBuffer());
      const base = {
        id: crypto.randomUUID(),
        originalName: file.name,
        size: file.size,
        createdAt: Date.now(),
      };
      let resource: Resource;
      if (isCsv(file)) {
        // A CSV keeps its own name: the content stays out of the LLM, and its header is its identity.
        try {
          const shapeHash = await csvShapeHash(bytes);
          resource = { ...base, name: file.name, contentType: CSV_TYPE, shapeHash };
        } catch (error) {
          return c.json({ error: error instanceof Error ? error.message : String(error) }, 400);
        }
      } else {
        const name = (await suggestImageName(c.env, file.type, bytes)) ?? file.name;
        resource = { ...base, name, contentType: file.type, shapeHash: null };
      }
      await c.env.RESOURCES.put(objectKey(resource.id), bytes, {
        httpMetadata: { contentType: resource.contentType },
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

function objectKey(id: string): string {
  return `resources/${id}`;
}
