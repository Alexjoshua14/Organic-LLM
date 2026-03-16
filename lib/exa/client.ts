"use server";

import Exa, { RegularSearchOptions, SearchResponse } from "exa-js";

import { ExaContentResponse, ExaSearchOptions, ExaSearchResponse } from "./types";
import { getApiKey, mapToSources } from "./utils";

import { RabbitHoleSource } from "@/lib/schemas/rabbitHoleSchemas";
import { createLogger } from "@/lib/logger";
import { Result } from "@/types";

const logger = createLogger("lib/exa/client");

const EXA_SEARCH_URL = "https://api.exa.ai/search";
const EXA_CONTENTS_URL = "https://api.exa.ai/contents";

const DEFAULT_NUM_RESULTS = 8;

const exa = new Exa(getApiKey() ?? undefined);

export async function searchWebWithQuery(
  query: string,
  options: Partial<RegularSearchOptions> = {}
): Promise<
  Result<
    | SearchResponse<{ highlights: true }>
    | SearchResponse<{ text: true }>
    | SearchResponse<{ highlights: true; text: true }>,
    Error
  >
> {
  try {
    const start = performance.now();

    const searchResult = await exa.search(query, {
      ...options,
      numResults: options.numResults ?? DEFAULT_NUM_RESULTS,
      type: options.type ?? "auto",
    });

    const end = performance.now();

    logger.log(
      "searchWebWithQuery",
      `Query="${query}" results=${searchResult.results.length} elapsed=${(end - start).toFixed(1)}ms`
    );

    return { data: searchResult, error: null };
  } catch (error) {
    logger.error("searchWebWithQuery", `Error for query="${query}": ${error}`);

    return {
      data: null,
      error: error instanceof Error ? error : new Error("Unknown Exa error"),
    };
  }
}

export async function searchWeb(
  query: string,
  options: Partial<ExaSearchOptions> = {}
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
      logger.error("searchWeb", `HTTP ${res.status} ${res.statusText} for query="${query}"`);

      return {
        sources: [],
        error: new Error(`Exa search failed: ${res.status} ${res.statusText}`),
      };
    }

    const data = (await res.json()) as ExaSearchResponse;
    const sources = mapToSources(data.results || []);

    logger.log(
      "searchWeb",
      `query="${query}" results=${sources.length} elapsed=${(performance.now() - start).toFixed(
        1
      )}ms`
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
      logger.error("getContents", `HTTP ${res.status} ${res.statusText} for urls=${urls.length}`);

      return {
        contents: [],
        error: new Error(`Exa contents failed: ${res.status} ${res.statusText}`),
      };
    }

    const data = (await res.json()) as ExaContentResponse;

    logger.log(
      "getContents",
      `urls=${urls.length} results=${data.results?.length ?? 0} elapsed=${(
        performance.now() - start
      ).toFixed(1)}ms`
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
