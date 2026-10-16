import { afterEach, expect, test, vi } from "vite-plus/test";
import { createSpeech } from "../src/speech.ts";

afterEach(() => {
  vi.unstubAllGlobals();
});

test("dialogue sends turns as multi-speaker input and returns the audio bytes", async () => {
  const fetch = vi.fn().mockResolvedValue(new Response(new Uint8Array([1, 2, 3])));
  vi.stubGlobal("fetch", fetch);

  const turns = [
    { voice: "Kore", text: "How's it going?" },
    { voice: "Puck", text: "Not bad.", instructions: "tired" },
  ] as const;
  const audio = await createSpeech({ apiKey: "key" }).dialogue([...turns]);

  expect(fetch).toHaveBeenCalledWith("https://openrouter.ai/api/v1/audio/speech", {
    method: "POST",
    headers: { Authorization: "Bearer key", "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-3.8-flash-tts",
      input: turns,
      response_format: "mp3",
    }),
  });
  expect(audio).toEqual(new Uint8Array([1, 2, 3]));
});

test("dialogue throws with the response body on failure", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("bad voice", { status: 400 })));

  await expect(
    createSpeech({ apiKey: "key" }).dialogue([{ voice: "Kore", text: "hi" }]),
  ).rejects.toThrow("Speech request failed (400): bad voice");
});
