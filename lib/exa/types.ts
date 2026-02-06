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

export const searchOptionsSchema = z.object({
  numResults: z.number().describe("The number of results to return"),
  type: z
    .enum(["auto", "neural", "keyword", "hybrid", "fast"])
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

export const ExaSearchResultSource = z.object({
  id: z.string(),
  title: z.string(),
  url: z.string().optional(),
  faviconUrl: z.string().optional(),
  snippet: z.string().optional(),
  publishedDate: z.string().optional(),
  author: z.string().optional(),
  highlights: z.array(z.string()).optional(),
});

export type ExaSearchResultSource = z.infer<typeof ExaSearchResultSource>;
