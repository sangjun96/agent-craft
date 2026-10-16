import { expect, test } from "vite-plus/test";
import { handleApi } from "../worker/api.ts";

test("handleApi responds with the request path", async () => {
  const response = handleApi(new Request("http://localhost/hello"));
  expect(await response.text()).toBe("Hello from /hello");
});
