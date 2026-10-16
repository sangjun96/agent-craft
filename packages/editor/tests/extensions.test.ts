import { Editor, getSchema, type Extensions } from "@tiptap/core";
import { expect, test } from "vite-plus/test";
import { createExtensions } from "../src/create-extensions.ts";
import { CodeBlock } from "../src/extensions/code-block.ts";
import { Markdown } from "../src/extensions/markdown.ts";

function headless(extensions: Extensions, content: string) {
  return new Editor({
    element: null,
    extensions: createExtensions({ extensions }),
    content,
    contentType: "markdown",
  });
}

test("CodeBlock replaces StarterKit's code block and keeps the language", () => {
  const extensions = createExtensions({ extensions: [CodeBlock] });
  expect(extensions[0]?.options).toMatchObject({ codeBlock: false });
  expect(getSchema(extensions).nodes.codeBlock).toBeDefined();
});

test("CodeBlock highlights tokens with hljs classes", () => {
  const tree = CodeBlock.options.lowlight.highlight("ts", "const a = 1;");
  expect(JSON.stringify(tree)).toContain("hljs-keyword");
});

test("Markdown round-trips headings, marks and fenced code", () => {
  const markdown = "# 실험 1\n\n**gpt** 대비 *빠름*\n\n```ts\nconst a = 1;\n```";
  const editor = headless([CodeBlock, Markdown], markdown);

  expect(editor.getJSON().content?.map((node) => node.type)).toEqual([
    "heading",
    "paragraph",
    "codeBlock",
  ]);
  expect(editor.getJSON().content?.[2]?.attrs?.language).toBe("ts");
  expect(editor.getMarkdown()).toBe(markdown);
});
