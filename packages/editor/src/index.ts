export { createExtensions, type ExtensionsOptions } from "./create-extensions.ts";
export { type RichEditorOptions, useRichEditor } from "./use-rich-editor.ts";

// Composition pieces, re-exported so apps depend on this package rather than on Tiptap directly.
export type { Editor, Extensions, JSONContent } from "@tiptap/core";
export { EditorContent, Tiptap, useTiptap, useTiptapState } from "@tiptap/react";
