import { getAgentByName } from "agents";
import { Hono } from "hono";
import { validator } from "hono/validator";
import { requireAccess } from "../access.ts";
import type { Env } from "../env.ts";

export const agents = new Hono<{ Bindings: Env }>()
  .use("*", requireAccess)
  .post(
    "/bbox-agent/run",
    validator("json", (value, c) => {
      const image = typeof value.image === "string" ? value.image : "";
      const target = typeof value.target === "string" ? value.target.trim() : "";
      if (!image) return c.json({ error: "이미지를 선택하세요" }, 400);
      if (!target) return c.json({ error: "찾을 대상을 입력하세요" }, 400);
      return { image, target };
    }),
    async (c) => {
      try {
        const stub = await getAgentByName(c.env.BboxAgent, "default");
        const runId = await stub.run(c.req.valid("json"));
        return c.json({ runId }, 201);
      } catch (error) {
        return c.json({ error: error instanceof Error ? error.message : String(error) }, 400);
      }
    },
  )
  .post(
    "/curriculum-classifier-agent/run",
    validator("json", (value, c) => {
      const image = typeof value.image === "string" ? value.image : "";
      const curriculumCsv = typeof value.curriculumCsv === "string" ? value.curriculumCsv : "";
      if (!image) return c.json({ error: "이미지를 선택하세요" }, 400);
      if (!curriculumCsv) return c.json({ error: "커리큘럼 CSV를 선택하세요" }, 400);
      return { image, curriculumCsv };
    }),
    async (c) => {
      try {
        const stub = await getAgentByName(c.env.CurriculumClassifierAgent, "default");
        const runId = await stub.run(c.req.valid("json"));
        return c.json({ runId }, 201);
      } catch (error) {
        return c.json({ error: error instanceof Error ? error.message : String(error) }, 400);
      }
    },
  );
