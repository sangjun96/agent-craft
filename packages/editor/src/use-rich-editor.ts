import { useEditor, type UseEditorOptions } from "@tiptap/react";
import type { DependencyList } from "react";
import { createExtensions, type ExtensionsOptions } from "./create-extensions.ts";

export interface RichEditorOptions
  extends Omit<UseEditorOptions, "extensions" | "immediatelyRender">, ExtensionsOptions {
  /**
   * Classes for the editable element itself, not a wrapper, so typography styles
   * such as `prose` apply to the document directly. The package ships no styles.
   */
  className?: string;
}

export function toEditorOptions({
  className,
  starterKit,
  extensions,
  editorProps,
  ...options
}: RichEditorOptions): UseEditorOptions {
  const attributes = editorProps?.attributes;
  return {
    ...options,
    extensions: createExtensions({ starterKit, extensions }),
    editorProps: {
      ...editorProps,
      attributes: (state) => {
        const attrs = typeof attributes === "function" ? attributes(state) : attributes;
        const classes = [className, attrs?.class].filter(Boolean).join(" ");
        return classes ? { ...attrs, class: classes } : { ...attrs };
      },
    },
  };
}

/** `useEditor` with the base extensions and an injectable `className`. Client-only (renders immediately). */
export function useRichEditor(options: RichEditorOptions = {}, deps?: DependencyList) {
  return useEditor(toEditorOptions(options), deps);
}
