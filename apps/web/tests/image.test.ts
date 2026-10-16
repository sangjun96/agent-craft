import { expect, test } from "vite-plus/test";
import { isImage, toBase64, toFileName } from "../worker/resources/image.ts";

test("isImage accepts the formats the naming LLM supports", () => {
  expect(isImage({ type: "image/webp" })).toBe(true);
  expect(isImage({ type: "image/svg+xml" })).toBe(false);
  expect(isImage({ type: "text/csv" })).toBe(false);
});

test("toFileName joins words with dashes and adds the extension for the type", () => {
  expect(toFileName("  빨간 머그컵 ", "image/jpeg")).toBe("빨간-머그컵.jpg");
  expect(toFileName("회의실 화이트보드.png", "image/png")).toBe("회의실-화이트보드.png");
});

test("toFileName strips path characters and gives up on empty suggestions", () => {
  expect(toFileName('a/b:"c"', "image/gif")).toBe("abc.gif");
  expect(toFileName(" / ", "image/png")).toBeUndefined();
});

test("toBase64 encodes bytes beyond a single chunk", () => {
  const bytes = new Uint8Array(70_000).map((_, i) => i % 256);
  const decoded = Uint8Array.from(atob(toBase64(bytes)), (char) => char.charCodeAt(0));
  expect(decoded).toEqual(bytes);
  expect(toBase64(new TextEncoder().encode("hi"))).toBe("aGk=");
});
