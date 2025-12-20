"use server";

export interface ExaSearchOptions {
  numResults?: number;
  type?: "auto" | "neural" | "keyword";
  includeDomains?: string[];
  excludeDomains?: string[];
}

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
