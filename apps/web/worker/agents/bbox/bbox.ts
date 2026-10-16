import type { Answer, Question } from "ai-services/system-one";
import type { BboxResult } from "../types.ts";

// Durable Object SQLite caps a single value at 2 MB.
const MAX_IMAGE_LENGTH = 1_500_000;

export function validateImage(image: string): void {
  if (!/^data:image\/(png|jpeg);base64,/.test(image)) {
    throw new Error("PNG 또는 JPEG data URL만 지원합니다");
  }
  if (image.length > MAX_IMAGE_LENGTH) throw new Error("이미지가 너무 큽니다 (최대 1.5MB)");
}

export function buildQuestions(target: string): Record<string, Question> {
  return {
    present: { type: "noul", instructions: `Is ${target} visible in the image?` },
    target: { type: "box", instructions: target },
  };
}

export function toResult(answers: Record<string, Answer>): BboxResult {
  const { present, target } = answers;
  return {
    present: present?.type === "noul" ? present.noul : undefined,
    box: target?.type === "box" ? target.box : undefined,
    confidence: target?.type === "box" ? target.confidence : undefined,
  };
}
