import { afterEach, expect, test, vi } from "vite-plus/test";
import { createSystemOne, type ImagePart } from "../src/system-one.ts";

afterEach(() => {
  vi.unstubAllGlobals();
});

test("decide sends image state and box questions to jev-latest and returns the answers", async () => {
  const answers = {
    present: { type: "noul", noul: 0.97 },
    product: { type: "box", box: { top: 0.49, bottom: 0.89, left: 0.58, right: 0.96 } },
  };
  const fetch = vi.fn().mockResolvedValue(Response.json({ answers, model: "typesafe/jev-1.14" }));
  vi.stubGlobal("fetch", fetch);

  const image: ImagePart = {
    type: "image_url",
    image_url: { url: "data:image/png;base64,iVBORw0KGgo=" },
  };
  const state = ["Product photo from the listing:", image];
  const questions = {
    present: { type: "noul", instructions: "Is a product visible in the photo?" },
    product: { type: "box", instructions: "the product in the listing photo" },
  } as const;
  const result = await createSystemOne({ apiKey: "key" }).decide(state, questions);

  expect(fetch).toHaveBeenCalledWith("https://openrouter.ai/api/alpha/decisions", {
    method: "POST",
    headers: { Authorization: "Bearer key", "Content-Type": "application/json" },
    body: JSON.stringify({ model: "~typesafe/jev-latest", state, questions }),
  });
  expect(result).toEqual(answers);
});

test("decide reports the raw snake_case usage as camelCase through onUsage", async () => {
  const usage = { input_tokens: 1200, output_tokens: 40, cost: 0.0004 };
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ answers: {}, usage })));
  const onUsage = vi.fn();

  await createSystemOne({ apiKey: "key", onUsage }).decide("x", {
    q: { type: "noul", instructions: "?" },
  });

  expect(onUsage).toHaveBeenCalledWith({ inputTokens: 1200, outputTokens: 40, cost: 0.0004 });
});

test("decide throws with the status and body when the request fails", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("bad image", { status: 400 })));

  await expect(
    createSystemOne({ apiKey: "key" }).decide("x", { q: { type: "noul", instructions: "?" } }),
  ).rejects.toThrow("Decisions request failed (400): bad image");
});
