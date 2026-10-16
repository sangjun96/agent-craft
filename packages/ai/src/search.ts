import { Exa, type HighlightsResponse, type TextResponse } from "exa-js";

export type SearchRequest = {
  query: string;
  numResults?: number;
  text?: boolean | { maxCharacters: number };
  highlights?: boolean;
};

export type SearchResult = {
  url: string;
  title: string | null;
  publishedDate?: string;
  text?: string;
  highlights?: string[];
};

export function createSearch(options: { apiKey: string }) {
  const client = new Exa(options.apiKey);

  return {
    async search(request: SearchRequest): Promise<SearchResult[]> {
      const { results } = await client.search(request.query, {
        numResults: request.numResults,
        contents: {
          text: request.text || undefined,
          highlights: request.highlights || undefined,
        },
      });

      // Content fields depend on the request options, so the SDK can't type them for a dynamic request.
      return results.map(
        (result: (typeof results)[number] & Partial<TextResponse & HighlightsResponse>) => ({
          url: result.url,
          title: result.title,
          publishedDate: result.publishedDate,
          text: result.text,
          highlights: result.highlights,
        }),
      );
    },
  };
}
