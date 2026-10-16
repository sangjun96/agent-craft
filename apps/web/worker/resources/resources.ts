const MAX_SIZE = 10 * 1024 * 1024;
const MAX_NAME_LENGTH = 60;
// Image formats both browsers and the naming LLM accept, with the extension given to suggested names.
const EXTENSIONS: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
};

export const NAMING_PROMPT = `이 이미지의 파일명을 지어줘.
- 핵심 피사체나 내용을 2~5 단어의 한국어로 요약
- 확장자, 날짜, 따옴표는 넣지 말 것
- 예: 빨간 머그컵, 회의실 화이트보드 메모`;

/** Returns why the file can't be stored, or undefined when it can. */
export function validateUpload(file: { type: string; size: number }): string | undefined {
  if (!(file.type in EXTENSIONS)) return "PNG, JPEG, WEBP, GIF 이미지만 업로드할 수 있습니다";
  if (file.size > MAX_SIZE) return "이미지가 너무 큽니다 (최대 10MB)";
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
