// Plain types shared by the worker and the web app; keep this file free of runtime imports.
import type { resources } from "../db/schema.ts";

/** An uploaded image: metadata in D1, bytes in R2. */
export type Resource = typeof resources.$inferSelect;
