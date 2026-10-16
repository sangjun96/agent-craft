import { expect, test } from "vite-plus/test";
import worker from "../worker/index.ts";

test("fetch responds with the request path", async () => {
  const response = worker.fetch(new Request("http://localhost/hello"));
  expect(await response.text()).toBe("Hello from /hello");
});
