import { CodeBlockLowlight } from "@tiptap/extension-code-block-lowlight";
import { common, createLowlight } from "lowlight";
import { createElement, type ReactNode } from "react";
import "../render-static.ts";

type HighlightNodes = ReturnType<ReturnType<typeof createLowlight>["highlight"]>["children"];

function toReact(nodes: HighlightNodes): ReactNode[] {
  return nodes.map((node, index) => {
    if (node.type === "text") return node.value;
    if (node.type !== "element") return null;
    const className = node.properties.className;
    return createElement(
      node.tagName,
      { key: index, className: Array.isArray(className) ? className.join(" ") : undefined },
      toReact(node.children),
    );
  });
}

/**
 * Code block with syntax highlighting for highlight.js's common languages.
 * Replaces StarterKit's plain code block. Tokens get `hljs-*` classes; the app supplies the theme.
 */
export const CodeBlock = CodeBlockLowlight.extend({
  // Same rule as the editor's highlight plugin: known language, otherwise auto-detect.
  renderStatic({ node }) {
    const { lowlight, defaultLanguage, languageClassPrefix } = this.options;
    const language: string | null = node.attrs.language || defaultLanguage;
    const tree =
      language && lowlight.registered(language)
        ? lowlight.highlight(language, node.textContent)
        : lowlight.highlightAuto(node.textContent);
    return createElement(
      "pre",
      null,
      createElement(
        "code",
        { className: language ? `${languageClassPrefix}${language}` : undefined },
        toReact(tree.children),
      ),
    );
  },
}).configure({ lowlight: createLowlight(common) });
