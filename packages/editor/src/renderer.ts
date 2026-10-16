import type { JSONContent } from "@tiptap/core";
import { renderToReactElement } from "@tiptap/static-renderer/pm/react";
import { createElement } from "react";
import { createExtensions, type ExtensionsOptions } from "./create-extensions.ts";
import { staticNodeMapping } from "./render-static.ts";

export interface RichRendererProps extends ExtensionsOptions {
  /** Document from `editor.getJSON()`. */
  content: JSONContent;
  /** Same role as in `useRichEditor`: put `prose` here. */
  className?: string;
}

/**
 * Read-only rendering without an editor instance (works in SSR too).
 * Pass the same extensions as the editor so both render the same document alike.
 */
export function RichRenderer({ content, className, ...extensionsOptions }: RichRendererProps) {
  const extensions = createExtensions(extensionsOptions);
  return createElement(
    "div",
    { className },
    renderToReactElement({
      content,
      extensions,
      options: { nodeMapping: staticNodeMapping(extensions) },
    }),
  );
}
