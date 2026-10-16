import { expect, test } from "vite-plus/test";
import { api } from "../worker/api.ts";

test("api responds with the request path for unknown GET routes", async () => {
  const response = await api.request("/hello");
  expect(await response.text()).toBe("Hello from /hello");
});

test("api returns 404 for unsupported methods on a resource", async () => {
  const response = await api.request("/resources/abc/file", { method: "POST" });
  expect(response.status).toBe(404);
});

test("PATCH rejects a blank name before touching storage", async () => {
  const response = await api.request("/resources/abc", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "  " }),
  });
  expect(response.status).toBe(400);
  expect(await response.json()).toEqual({ error: "이름을 입력하세요" });
});

test("POST rejects a request without a file", async () => {
  const response = await api.request("/resources", { method: "POST", body: new FormData() });
  expect(response.status).toBe(400);
});

function postFile(file: File) {
  const body = new FormData();
  body.set("file", file);
  return api.request("/resources", { method: "POST", body });
}

test("POST rejects files that are neither images nor CSVs", async () => {
  const response = await postFile(new File(["x"], "a.pdf", { type: "application/pdf" }));
  expect(response.status).toBe(400);
  expect(await response.json()).toEqual({
    error: "PNG, JPEG, WEBP, GIF 이미지 또는 CSV만 업로드할 수 있습니다",
  });
});

test("POST rejects files over 10MB", async () => {
  const big = new Uint8Array(10 * 1024 * 1024 + 1);
  const response = await postFile(new File([big], "a.png", { type: "image/png" }));
  expect(response.status).toBe(400);
  expect(await response.json()).toEqual({ error: "파일이 너무 큽니다 (최대 10MB)" });
});

test("POST treats a .csv without a MIME type as a CSV", async () => {
  // Reaching the header check means the upload validation let the file through.
  const response = await postFile(new File([""], "a.csv", { type: "" }));
  expect(await response.json()).toEqual({ error: "CSV 헤더 행이 비어 있습니다" });
});

test("POST rejects a CSV without a header row before touching storage", async () => {
  const response = await postFile(new File(["\n1,2"], "a.csv", { type: "text/csv" }));
  expect(response.status).toBe(400);
  expect(await response.json()).toEqual({ error: "CSV 헤더 행이 비어 있습니다" });
});
