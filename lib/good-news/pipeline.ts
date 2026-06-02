import "server-only";

import { generateObject } from "ai";

import { EXTRACTION_SYSTEM_PROMPT, FACTCHECK_SYSTEM_PROMPT } from "./prompts";
import { ALL_ALLOWED_DOMAINS, isAllowedUrl } from "./sources";
import { buildVerifiedSources, evaluateCorroboration } from "./verify";

import { getContents, searchWeb } from "@/lib/exa/client";
import { KNOWLEDGE_GATEWAY_PROVIDER_OPTIONS } from "@/lib/knowledge/gateway-options";
import { createLogger } from "@/lib/logger";
import { recordLlmCall } from "@/lib/llm/metrics";
import { SEED_QUERIES } from "@/lib/good-news/queries";
import {
  CandidateExtractionSchema,
  CandidateItem,
  FactCheckResultSchema,
  GoodNewsDigest,
  GoodNewsItem,
  GoodNewsItemSchema,
} from "@/lib/schemas/good-news";
import { dateStringCompare } from "@/lib/utils";

const logger = createLogger("lib/good-news/pipeline.ts");

const EXTRACTION_MODEL = "openai/gpt-5.4-mini" as const;
const FACTCHECK_MODEL = "openai/gpt-5.2" as const;

const RECENCY_WINDOW_DAYS = 9;
const MAX_SOURCES_FOR_EXTRACTION = 60;
const MAX_CONTENT_FETCHES = 24;
const CONFIDENCE_THRESHOLD = 0.7;
const TARGET_ITEM_COUNT = 10;
const FACTCHECK_CONCURRENCY = 4;

type SourceMeta = {
  url: string;
  title?: string;
  domain?: string;
  snippet?: string;
  publishedAt?: string;
};

/** Run async work over a list with a fixed concurrency ceiling. */
async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;

  async function worker() {
    while (cursor < items.length) {
      const index = cursor++;

      results[index] = await fn(items[index], index);
    }
  }

  const workers = Array.from({ length: Math.min(limit, items.length) }, () => worker());

  await workers.reduce(async (prev, w) => {
    await prev;

    return w;
  }, Promise.resolve());

  return results;
}

function isWithinRecencyWindow(publishedAt: string | undefined, now: Date): boolean {
  if (!publishedAt) return true; // keep undated; fact-check stage can still reject

  const published = new Date(publishedAt);

  if (Number.isNaN(published.getTime())) return true;

  const ageMs = now.getTime() - published.getTime();

  return ageMs <= RECENCY_WINDOW_DAYS * 24 * 60 * 60 * 1000 && ageMs >= -24 * 60 * 60 * 1000;
}

/** Step 1: search the allowlist across every seed query and dedupe by URL. */
async function gatherSources(now: Date): Promise<Map<string, SourceMeta>> {
  const byUrl = new Map<string, SourceMeta>();

  const searches = await Promise.all(
    SEED_QUERIES.map(async (seed) => {
      const { sources, error } = await searchWeb(seed.query, {
        numResults: 10,
        includeDomains: [...ALL_ALLOWED_DOMAINS],
      });

      if (error) {
        logger.error("gatherSources", `Search failed for "${seed.query}": ${error.message}`);

        return [];
      }

      return sources;
    })
  );

  for (const sources of searches) {
    for (const s of sources) {
      if (!s.url || !isAllowedUrl(s.url)) continue;
      if (byUrl.has(s.url)) continue;

      const publishedAt = s.publishedDate ?? undefined;

      if (!isWithinRecencyWindow(publishedAt, now)) continue;

      byUrl.set(s.url, {
        url: s.url,
        title: s.title ?? undefined,
        snippet: s.snippet ?? undefined,
        publishedAt,
      });
    }
  }

  logger.log("gatherSources", `Collected ${byUrl.size} unique allowlisted sources`);

  return byUrl;
}

/** Step 2: cluster + extract candidate stories from the raw sources. */
async function extractCandidates(sources: SourceMeta[]): Promise<CandidateItem[]> {
  if (sources.length === 0) return [];

  const list = sources
    .slice(0, MAX_SOURCES_FOR_EXTRACTION)
    .map((s, i) => {
      const date = s.publishedAt ? ` | ${s.publishedAt}` : "";

      return `[${i}] ${s.title ?? s.url}${date}\n    ${s.url}\n    ${(s.snippet ?? "").slice(0, 260)}`;
    })
    .join("\n");

  const started = performance.now();

  try {
    const { object, usage } = await generateObject({
      model: EXTRACTION_MODEL,
      system: EXTRACTION_SYSTEM_PROMPT,
      prompt: `Today's candidate articles:\n\n${list}\n\nCluster and extract the positive-news candidates.`,
      schema: CandidateExtractionSchema,
      maxOutputTokens: 4_000,
      providerOptions: KNOWLEDGE_GATEWAY_PROVIDER_OPTIONS,
    });

    recordLlmCall({
      model: EXTRACTION_MODEL,
      usage,
      durationMs: performance.now() - started,
      metadata: { operation: "goodNewsExtraction" },
    });

    // Defensive: keep only URLs that were actually provided + on the allowlist.
    const allowedUrls = new Set(sources.map((s) => s.url));

    return object.candidates
      .map((c) => ({
        ...c,
        sourceUrls: [...new Set(c.sourceUrls)].filter((u) => allowedUrls.has(u) && isAllowedUrl(u)),
      }))
      .filter((c) => c.sourceUrls.length > 0);
  } catch (err) {
    logger.error("extractCandidates", err instanceof Error ? err.message : String(err));

    return [];
  }
}

/** Step 4: fetch full text for the surviving candidates' sources. */
async function fetchContentText(urls: string[]): Promise<Map<string, string>> {
  const textByUrl = new Map<string, string>();
  const unique = [...new Set(urls)].slice(0, MAX_CONTENT_FETCHES);

  if (unique.length === 0) return textByUrl;

  const { contents, error } = await getContents(unique);

  if (error) {
    logger.error("fetchContentText", `getContents failed: ${error.message}`);

    return textByUrl;
  }

  for (const c of contents) {
    if (c.url && c.text) textByUrl.set(c.url, c.text);
  }

  return textByUrl;
}

/** Step 5: fact-check a single candidate against its source text. */
async function factCheckCandidate(
  candidate: CandidateItem,
  textByUrl: Map<string, string>,
  metaByUrl: Map<string, SourceMeta>
): Promise<GoodNewsItem | null> {
  const sourceBlocks = candidate.sourceUrls
    .map((url) => {
      const text = textByUrl.get(url) ?? metaByUrl.get(url)?.snippet ?? "";

      return `URL: ${url}\nTEXT: ${text.slice(0, 2_500)}`;
    })
    .join("\n\n---\n\n");

  const started = performance.now();

  let result;

  try {
    const { object, usage } = await generateObject({
      model: FACTCHECK_MODEL,
      system: FACTCHECK_SYSTEM_PROMPT,
      prompt: `CLAIM: ${candidate.claim}\nCATEGORY: ${candidate.category}\n\nSOURCES:\n\n${sourceBlocks}`,
      schema: FactCheckResultSchema,
      maxOutputTokens: 1_200,
      providerOptions: KNOWLEDGE_GATEWAY_PROVIDER_OPTIONS,
    });

    recordLlmCall({
      model: FACTCHECK_MODEL,
      usage,
      durationMs: performance.now() - started,
      metadata: { operation: "goodNewsFactCheck" },
    });

    result = object;
  } catch (err) {
    logger.error("factCheckCandidate", err instanceof Error ? err.message : String(err));

    return null;
  }

  if (!result.isSupported || result.confidence < CONFIDENCE_THRESHOLD) {
    return null;
  }

  // Re-run deterministic corroboration on the model's confirmed URLs.
  const supportingUrls = result.supportingUrls.filter((u) => isAllowedUrl(u));
  const corroboration = evaluateCorroboration(supportingUrls);

  if (!corroboration.passed) {
    return null;
  }

  const verifiedSources = buildVerifiedSources(
    supportingUrls,
    new Map(
      [...metaByUrl.entries()].map(([url, m]) => [
        url,
        { title: m.title, publishedAt: m.publishedAt },
      ])
    )
  );

  if (verifiedSources.length === 0) return null;

  const publishedAt = verifiedSources
    .map((s) => s.publishedAt)
    .filter((d): d is string => Boolean(d))
    .sort((a, b) => dateStringCompare(b, a))[0];

  return {
    rank: 0, // assigned after ranking
    headline: result.headline,
    summary: result.summary,
    whyItMatters: result.whyItMatters,
    category: result.category,
    sources: verifiedSources,
    publishedAt,
    confidence: result.confidence,
    verification: `${corroboration.reason}. ${result.verification}`.slice(0, 400),
  };
}

/**
 * Run the full daily good-news pipeline:
 * search -> cluster/extract -> corroboration filter -> fetch contents ->
 * fact-check -> final corroboration -> rank top 10.
 */
export async function runGoodNewsPipeline(opts?: { now?: Date }): Promise<GoodNewsDigest> {
  const now = opts?.now ?? new Date();
  const startedAt = performance.now();

  const metaByUrl = await gatherSources(now);
  const candidates = await extractCandidates([...metaByUrl.values()]);

  logger.log("runGoodNewsPipeline", `Extracted ${candidates.length} candidate clusters`);

  // Step 3: deterministic corroboration + drop speculative items before spending fact-check calls.
  const corroborated = candidates.filter((c) => {
    if (c.isSpeculative) return false;

    return evaluateCorroboration(c.sourceUrls).passed;
  });

  logger.log(
    "runGoodNewsPipeline",
    `${corroborated.length}/${candidates.length} candidates passed corroboration`
  );

  const textByUrl = await fetchContentText(corroborated.flatMap((c) => c.sourceUrls));

  const factChecked = (
    await mapWithConcurrency(corroborated, FACTCHECK_CONCURRENCY, (c) =>
      factCheckCandidate(c, textByUrl, metaByUrl)
    )
  ).filter((item): item is GoodNewsItem => item !== null);

  logger.log(
    "runGoodNewsPipeline",
    `${factChecked.length}/${corroborated.length} candidates passed fact-check`
  );

  // Rank: confidence first, then recency, then number of corroborating sources.
  const ranked = factChecked
    .sort((a, b) => {
      if (b.confidence !== a.confidence) return b.confidence - a.confidence;
      const byDate = dateStringCompare(b.publishedAt, a.publishedAt);

      if (byDate !== 0) return byDate;

      return b.sources.length - a.sources.length;
    })
    .slice(0, TARGET_ITEM_COUNT)
    .map((item, i) => ({ ...item, rank: i + 1 }));

  // Final schema validation; drop anything malformed.
  const items: GoodNewsItem[] = [];

  for (const item of ranked) {
    const parsed = GoodNewsItemSchema.safeParse(item);

    if (parsed.success) {
      items.push(parsed.data);
    } else {
      logger.error("runGoodNewsPipeline", `Dropping invalid item: ${parsed.error.message}`);
    }
  }

  const date = now.toISOString().slice(0, 10);

  logger.log(
    "runGoodNewsPipeline",
    `Built digest for ${date} with ${items.length} items in ${(performance.now() - startedAt).toFixed(0)}ms`
  );

  return {
    date,
    items,
    generatedAt: now.toISOString(),
    model: FACTCHECK_MODEL,
    meta: {
      sourcesConsidered: metaByUrl.size,
      candidatesExtracted: candidates.length,
      candidatesCorroborated: corroborated.length,
      itemsVerified: items.length,
    },
  };
}
