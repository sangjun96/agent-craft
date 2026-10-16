/**
 * Markdown in and out: `contentType: "markdown"` on content/setContent, and `editor.getMarkdown()`.
 * Each node serializes through its own extension, so it works with whatever else is composed.
 */
export { Markdown } from "@tiptap/markdown";
