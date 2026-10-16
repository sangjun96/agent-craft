import { expect, test } from "vite-plus/test";
import { buildQuestions, toResult, validateImage } from "../worker/agents/bbox/bbox.ts";

test("buildQuestions asks for presence and a box around the target", () => {
  expect(buildQuestions("the red mug")).toEqual({
    present: { type: "noul", instructions: "Is the red mug visible in the image?" },
    target: { type: "box", instructions: "the red mug" },
  });
});

test("toResult reads the presence probability and the box", () => {
  const box = { top: 0.1, bottom: 0.5, left: 0.2, right: 0.6 };
  expect(
    toResult({
      present: { type: "noul", noul: 0.92 },
      target: { type: "box", box, confidence: 0.8 },
    }),
  ).toEqual({ present: 0.92, box, confidence: 0.8 });
});

test("validateImage accepts PNG and JPEG data URLs", () => {
  expect(() => validateImage("data:image/png;base64,iVBORw0KGgo=")).not.toThrow();
  expect(() => validateImage("data:image/jpeg;base64,/9j/4AAQ")).not.toThrow();
});

test("validateImage rejects other formats and oversized images", () => {
  expect(() => validateImage("data:image/gif;base64,R0lGOD")).toThrow("PNG 또는 JPEG");
  expect(() => validateImage(`data:image/png;base64,${"A".repeat(1_500_000)}`)).toThrow(
    "너무 큽니다",
  );
});
