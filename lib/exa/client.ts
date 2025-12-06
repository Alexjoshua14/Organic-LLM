"use server";

import { RabbitHoleSource } from "@/app/rabbitholes/_lib/types";
import { createLogger } from "@/lib/logger";

import {
  ExaContentResponse,
  ExaSearchOptions,
  ExaSearchResponse,
} from "./types";

const logger = createLogger("lib/exa/client");

const EXA_SEARCH_URL = "https://api.exa.ai/search";
const EXA_CONTENTS_URL = "https://api.exa.ai/contents";

function getApiKey(): string | null {
  return process.env.EXA_API_KEY ?? null;
}

function buildFavicon(url: string): string | undefined {
  try {
    const parsed = new URL(url);
    return `https://www.google.com/s2/favicons?domain=${parsed.hostname}`;
  } catch {
    return undefined;
  }
}

function mapToSources(
  results: ExaSearchResponse["results"]
): RabbitHoleSource[] {
  return results.map((doc, index) => {
    const snippet =
      doc.text?.slice(0, 280) ||
      (doc.highlights && doc.highlights.length > 0 ? doc.highlights[0] : "");

    return {
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

export async function searchWeb(
  query: string,
  options: ExaSearchOptions = {}
): Promise<{ sources: RabbitHoleSource[]; error: Error | null }> {
  const apiKey = getApiKey();
  if (!apiKey) {
    return { sources: [], error: new Error("Missing EXA_API_KEY") };
  }

  try {
    const start = performance.now();
    const body = {
      query,
      numResults: options.numResults ?? 8,
      type: options.type ?? "auto",
      includeDomains: options.includeDomains,
      excludeDomains: options.excludeDomains,
      useAutoprompt: true,
      text: true,
    };

    const res = await fetch(EXA_SEARCH_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      logger.error(
        "searchWeb",
        `HTTP ${res.status} ${res.statusText} for query="${query}"`,
      );
      return {
        sources: [],
        error: new Error(`Exa search failed: ${res.status} ${res.statusText}`),
      };
    }

    const data = (await res.json()) as ExaSearchResponse;
    const sources = mapToSources(data.results || []);
    logger.log(
      "searchWeb",
      `query="${query}" results=${sources.length} elapsed=${(
        performance.now() - start
      ).toFixed(1)}ms`,
    );
    return { sources, error: null };
  } catch (error) {
    logger.error("searchWeb", `Error for query="${query}": ${error}`);
    return {
      sources: [],
      error: error instanceof Error ? error : new Error("Unknown Exa error"),
    };
  }
}

export async function getContents(
  urls: string[]
): Promise<{ contents: ExaContentResponse["results"]; error: Error | null }> {
  const apiKey = getApiKey();
  if (!apiKey) {
    return { contents: [], error: new Error("Missing EXA_API_KEY") };
  }

  try {
    const start = performance.now();
    const body = {
      urls,
      text: true,
      html: false,
    };

    const res = await fetch(EXA_CONTENTS_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      logger.error(
        "getContents",
        `HTTP ${res.status} ${res.statusText} for urls=${urls.length}`,
      );
      return {
        contents: [],
        error: new Error(
          `Exa contents failed: ${res.status} ${res.statusText}`
        ),
      };
    }

    const data = (await res.json()) as ExaContentResponse;
    logger.log(
      "getContents",
      `urls=${urls.length} results=${data.results?.length ?? 0} elapsed=${(
        performance.now() - start
      ).toFixed(1)}ms`,
    );
    return { contents: data.results || [], error: null };
  } catch (error) {
    logger.error("getContents", `Error for urls=${urls.length}: ${error}`);
    return {
      contents: [],
      error: error instanceof Error ? error : new Error("Unknown Exa error"),
    };
  }
}
