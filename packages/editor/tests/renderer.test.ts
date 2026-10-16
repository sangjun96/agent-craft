import type { JSONContent } from "@tiptap/core";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vite-plus/test";
import { CodeBlock } from "../src/extensions/code-block.ts";
import { RichRenderer, type RichRendererProps } from "../src/renderer.ts";

const doc: JSONContent = {
  type: "doc",
  content: [
    { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "실험 1" }] },
    {
      type: "paragraph",
      content: [
        { type: "text", marks: [{ type: "bold" }], text: "gpt" },
        { type: "text", text: " 대비 빠름" },
      ],
    },
    {
      type: "codeBlock",
      attrs: { language: "ts" },
      content: [{ type: "text", text: "const a = 1;" }],
    },
  ],
};

function render(props: Partial<RichRendererProps> = {}) {
  return renderToStaticMarkup(createElement(RichRenderer, { content: doc, ...props }));
}

test("renders the document inside a wrapper carrying the injected className", () => {
  const html = render({ className: "prose prose-sm" });
  expect(html).toMatch(
    /^<div class="prose prose-sm"><h2>실험 1<\/h2><p><strong>gpt<\/strong> 대비 빠름<\/p>/,
  );
});

test("highlights code blocks the way the CodeBlock extension does in the editor", () => {
  const html = render({ extensions: [CodeBlock] });
  expect(html).toContain(
    '<pre><code class="language-ts"><span class="hljs-keyword">const</span> a = <span class="hljs-number">1</span>;</code></pre>',
  );
});

test("falls back to renderHTML for nodes without renderStatic", () => {
  expect(render()).toContain('<pre><code class="language-ts">const a = 1;</code></pre>');
});
