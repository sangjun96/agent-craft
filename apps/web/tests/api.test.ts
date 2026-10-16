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
