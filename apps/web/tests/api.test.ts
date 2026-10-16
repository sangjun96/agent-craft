import { expect, test } from "vite-plus/test";
import { handleApi } from "../worker/api.ts";
import type { Env } from "../worker/env.ts";

test("handleApi responds with the request path", async () => {
  const response = await handleApi(new Request("http://localhost/hello"), {} as Env);
  expect(await response.text()).toBe("Hello from /hello");
});
