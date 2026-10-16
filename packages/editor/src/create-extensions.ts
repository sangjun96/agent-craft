import type { Extensions } from "@tiptap/core";
import { StarterKit, type StarterKitOptions } from "@tiptap/starter-kit";

export interface ExtensionsOptions {
  /** Configures the bundled StarterKit. Set a key to `false` to drop it. */
  starterKit?: Partial<StarterKitOptions>;
  /**
   * Added after StarterKit, typically from `editor/extensions/*`. One that shares a
   * StarterKit extension's name (e.g. `CodeBlock` → `codeBlock`) replaces it.
   */
  extensions?: Extensions;
}

export function createExtensions({
  starterKit,
  extensions = [],
}: ExtensionsOptions = {}): Extensions {
  const replaced = Object.fromEntries(extensions.map((extension) => [extension.name, false]));
  return [StarterKit.configure({ ...starterKit, ...replaced }), ...extensions];
}
