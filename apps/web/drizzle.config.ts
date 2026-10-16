import { defineConfig } from "drizzle-kit";

// Only generates SQL; `cf d1 migrations apply` runs it (see the db:migrate:* scripts).
export default defineConfig({
  dialect: "sqlite",
  schema: "./worker/db/schema.ts",
  out: "./drizzle",
});
