import { Extension, getSchema, Node } from "@tiptap/core";
import { expect, test } from "vite-plus/test";
import { createExtensions } from "../src/create-extensions.ts";

test("includes the StarterKit nodes and marks by default", () => {
  const schema = getSchema(createExtensions());
  expect(Object.keys(schema.nodes)).toEqual(
    expect.arrayContaining(["doc", "paragraph", "heading", "codeBlock", "bulletList"]),
  );
  expect(Object.keys(schema.marks)).toEqual(expect.arrayContaining(["bold", "italic", "link"]));
});

test("drops a StarterKit extension set to false", () => {
  const schema = getSchema(createExtensions({ starterKit: { codeBlock: false } }));
  expect(schema.nodes.codeBlock).toBeUndefined();
  expect(schema.nodes.paragraph).toBeDefined();
});

test("appends extra extensions after StarterKit", () => {
  const Callout = Node.create({ name: "callout", group: "block", content: "inline*" });
  const Shortcuts = Extension.create({ name: "shortcuts" });
  const extensions = createExtensions({ extensions: [Callout, Shortcuts] });
  expect(extensions.slice(1)).toEqual([Callout, Shortcuts]);
  expect(getSchema(extensions).nodes.callout).toBeDefined();
});

test("an extension named like a StarterKit one replaces it, even if starterKit configures it", () => {
  const Heading = Node.create({ name: "heading", group: "block", content: "inline*" });
  const extensions = createExtensions({
    starterKit: { heading: { levels: [1, 2] } },
    extensions: [Heading],
  });
  expect(extensions[0]?.options).toMatchObject({ heading: false });
  expect(getSchema(extensions).nodes.heading?.spec.attrs).toBeUndefined();
});
