import { createLlm } from "ai-services/llm";
import * as z from "zod";
import type { Env } from "../env.ts";

const MAX_NAME_LENGTH = 60;
// Image formats both browsers and the naming LLM accept, with the extension given to suggested names.
const EXTENSIONS: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
};

const NAMING_PROMPT = `이 이미지의 파일명을 지어줘.
- 핵심 피사체나 내용을 2~5 단어의 한국어로 요약
- 확장자, 날짜, 따옴표는 넣지 말 것
- 예: 빨간 머그컵, 회의실 화이트보드 메모`;

export function isImage(file: { type: string }): boolean {
  return file.type in EXTENSIONS;
}

/** Asks the LLM for a descriptive file name; a failed suggestion must not fail the upload. */
export async function suggestImageName(
  env: Env,
  contentType: string,
  bytes: Uint8Array,
): Promise<string | undefined> {
  try {
    const { name } = await createLlm({ apiKey: env.OPENROUTER_API_KEY }).generateObject(
      [
        { type: "text", text: NAMING_PROMPT },
        {
          type: "image_url",
          imageUrl: { url: `data:${contentType};base64,${toBase64(bytes)}` },
        },
      ],
      z.object({ name: z.string() }),
    );
    return toFileName(name, contentType);
  } catch (error) {
    console.error("Resource name suggestion failed", error);
    return undefined;
  }
}

/** Turns an LLM suggestion into a safe file name with the extension for its type; undefined if nothing usable is left. */
export function toFileName(suggestion: string, contentType: string): string | undefined {
  const base = suggestion
    .replace(/\.[a-z0-9]{2,4}$/i, "")
    .replace(/[\\/:*?"<>|]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, MAX_NAME_LENGTH);
  return base ? `${base}.${EXTENSIONS[contentType]}` : undefined;
}

export function toBase64(bytes: Uint8Array): string {
  let binary = "";
  // Chunked so the spread stays under the engine's argument limit.
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}
