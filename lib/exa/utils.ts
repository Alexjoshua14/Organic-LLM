import { ExaSearchResponse, ExaSearchResultSource } from "./types";

import { RabbitHoleSource } from "@/lib/schemas/rabbitHoleSchemas";

export function getApiKey(): string | null {
  return process.env.EXA_API_KEY ?? null;
}

export function buildFavicon(url: string): string | undefined {
  try {
    const parsed = new URL(url);

    return `https://www.google.com/s2/favicons?domain=${parsed.hostname}`;
  } catch {
    return undefined;
  }
}

export function mapToSources(results: ExaSearchResponse["results"]): RabbitHoleSource[] {
  return results.map((doc, index) => {
    const snippet =
      doc.text?.slice(0, 280) ||
      (doc.highlights && doc.highlights.length > 0 ? doc.highlights[0] : "");

    return {
      status: "none",
      id: doc.id || doc.url || `exa-${index}`,
      title: doc.title || doc.url,
      url: doc.url,
      faviconUrl: buildFavicon(doc.url),
      snippet,
      publishedDate: doc.publishedDate,
      author: doc.author,
      highlights: doc.highlights,
    };
  });
}

/** Map Exa search response results to ExaSearchResultSource for streaming to the client. */
export function mapSearchResponseToExaSources(
  results: Array<{
    id?: string;
    title?: string | null;
    url: string;
    highlights?: string[];
    text?: string;
    publishedDate?: string;
    author?: string;
  }>
): ExaSearchResultSource[] {
  return results.map((doc, index) => {
    const snippet =
      doc.text?.slice(0, 280) ||
      (doc.highlights && doc.highlights.length > 0 ? doc.highlights[0] : "");

    return {
      id: doc.id ?? doc.url ?? `exa-${index}`,
      title: doc.title ?? doc.url,
      url: doc.url,
      faviconUrl: buildFavicon(doc.url),
      snippet: snippet || undefined,
      publishedDate: doc.publishedDate,
      author: doc.author,
      highlights: doc.highlights,
    };
  });
}
