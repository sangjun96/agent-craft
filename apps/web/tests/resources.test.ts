import { expect, test } from "vite-plus/test";
import { toBase64, toFileName, validateUpload } from "../worker/resources/resources.ts";

test("validateUpload accepts common image types up to 10MB", () => {
  expect(validateUpload({ type: "image/png", size: 1024 })).toBeUndefined();
  expect(validateUpload({ type: "image/webp", size: 10 * 1024 * 1024 })).toBeUndefined();
});

test("validateUpload rejects other types and oversized files", () => {
  expect(validateUpload({ type: "application/pdf", size: 1024 })).toContain("이미지만");
  expect(validateUpload({ type: "image/jpeg", size: 10 * 1024 * 1024 + 1 })).toContain(
    "너무 큽니다",
  );
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
