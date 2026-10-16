import { type Extensions, getExtensionField, resolveExtensions } from "@tiptap/core";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import type { ReactNode } from "react";

export interface StaticNodeProps {
  node: ProseMirrorNode;
  children?: ReactNode;
}

declare module "@tiptap/core" {
  interface NodeConfig<Options, Storage> {
    /**
     * React output for `RichRenderer`, for nodes whose look depends on editor plugins
     * (e.g. highlighting). Without it the renderer falls back to `renderHTML`.
     */
    renderStatic?: (
      this: { name: string; options: Options; storage: Storage },
      props: StaticNodeProps,
    ) => ReactNode;
  }
}

/** Collects each extension's `renderStatic` into a static-renderer node mapping. */
export function staticNodeMapping(extensions: Extensions) {
  return Object.fromEntries(
    resolveExtensions(extensions).flatMap((extension) => {
      const render = getExtensionField<((props: StaticNodeProps) => ReactNode) | undefined>(
        extension,
        "renderStatic",
        { name: extension.name, options: extension.options, storage: extension.storage },
      );
      return render ? [[extension.name, render]] : [];
    }),
  );
}
