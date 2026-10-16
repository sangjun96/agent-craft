import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

/** Uploaded images: metadata here, bytes in R2 under resources/{id}. */
export const resources = sqliteTable("resources", {
  id: text().primaryKey(),
  /** Display name, suggested by the LLM at upload and editable afterwards. */
  name: text().notNull(),
  /** File name the image was uploaded with. */
  originalName: text("original_name").notNull(),
  contentType: text("content_type").notNull(),
  size: integer().notNull(),
  /** Epoch milliseconds. */
  createdAt: integer("created_at").notNull(),
});
