import type { EditorState } from "@tiptap/pm/state";
import { expect, test } from "vite-plus/test";
import { toEditorOptions } from "../src/use-rich-editor.ts";

const state = {} as EditorState;

function attributesOf(options: Parameters<typeof toEditorOptions>[0]) {
  const attributes = toEditorOptions(options).editorProps?.attributes;
  return typeof attributes === "function" ? attributes(state) : attributes;
}

test("puts the injected className on the editable element", () => {
  expect(attributesOf({ className: "prose prose-sm" })).toEqual({ class: "prose prose-sm" });
});

test("keeps other attributes and merges their class", () => {
  expect(
    attributesOf({
      className: "prose",
      editorProps: { attributes: { class: "min-h-40", "aria-label": "노트" } },
    }),
  ).toEqual({ class: "prose min-h-40", "aria-label": "노트" });
});

test("supports attributes given as a function of state", () => {
  expect(
    attributesOf({
      className: "prose",
      editorProps: { attributes: () => ({ spellcheck: "false" }) },
    }),
  ).toEqual({ class: "prose", spellcheck: "false" });
});

test("sets no class when none is given", () => {
  expect(attributesOf({})).toEqual({});
});

test("passes other editor options through and builds extensions", () => {
  const onUpdate = () => {};
  const options = toEditorOptions({ content: "<p>hi</p>", editable: false, onUpdate });
  expect(options).toMatchObject({ content: "<p>hi</p>", editable: false, onUpdate });
  expect(options.extensions?.[0]?.name).toBe("starterKit");
});
