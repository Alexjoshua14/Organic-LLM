"use server";

import z from "zod";

export const exaSearchOptionsSchema = z.object({
  numResults: z.number().describe("The number of results to return"),
  type: z
    .enum(["auto", "neural", "keyword"])
    .describe("The type of search to perform"),
  includeDomains: z
    .array(z.string())
    .describe("The domains to include in the search"),
  excludeDomains: z
    .array(z.string())
    .describe("The domains to exclude from the search"),
});

export type ExaSearchOptions = z.infer<typeof exaSearchOptionsSchema>;

export interface ExaSearchDocument {
  id?: string;
  title?: string;
  url: string;
  author?: string;
  publishedDate?: string;
  highlights?: string[];
  text?: string;
  score?: number;
}

export interface ExaSearchResponse {
  results: ExaSearchDocument[];
}

export interface ExaContentResult {
  url: string;
  text?: string;
  html?: string;
}

export interface ExaContentResponse {
  results: ExaContentResult[];
}
