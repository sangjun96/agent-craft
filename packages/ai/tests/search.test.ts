import { expect, test, vi } from "vite-plus/test";
import { createSearch } from "../src/search.ts";

const search = vi.fn();

vi.mock("exa-js", () => ({
  Exa: class {
    search = search;
  },
}));

test("search maps request and results", async () => {
  search.mockResolvedValue({
    requestId: "r",
    results: [
      {
        id: "1",
        url: "https://example.com",
        title: "Example",
        publishedDate: "2026-01-01",
        score: 0.9,
        text: "body",
        highlights: ["hi"],
      },
    ],
  });

  const results = await createSearch({ apiKey: "key" }).search({
    query: "cloudflare workers",
    numResults: 3,
    text: { maxCharacters: 500 },
    highlights: true,
  });

  expect(search).toHaveBeenCalledWith("cloudflare workers", {
    numResults: 3,
    contents: { text: { maxCharacters: 500 }, highlights: true },
  });
  expect(results).toEqual([
    {
      url: "https://example.com",
      title: "Example",
      publishedDate: "2026-01-01",
      text: "body",
      highlights: ["hi"],
    },
  ]);
});
