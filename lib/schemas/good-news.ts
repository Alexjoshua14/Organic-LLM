import { z } from "zod";

/**
 * Credibility tier for a source domain.
 * - `high_trust`: a single source is sufficient to surface a claim.
 * - `standard`: requires corroboration from at least one other distinct domain.
 */
export const SourceTier = z.enum(["high_trust", "standard"]);
export type SourceTier = z.infer<typeof SourceTier>;

/** Topical buckets used for grouping and the category badge in the UI. */
export const GoodNewsCategory = z.enum([
  "health",
  "climate",
  "conservation",
  "conflict_resolution",
  "science",
  "technology",
  "social_progress",
  "humanitarian",
  "other",
]);
export type GoodNewsCategory = z.infer<typeof GoodNewsCategory>;

/** A single verified source backing a good-news item. */
export const GoodNewsSourceSchema = z.object({
  title: z.string().min(1).max(300),
  url: z.string().url(),
  domain: z.string().min(1),
  tier: SourceTier,
  publishedAt: z.string().optional(),
});
export type GoodNewsSource = z.infer<typeof GoodNewsSourceSchema>;

/** A finished, verified good-news item ready to render. */
export const GoodNewsItemSchema = z.object({
  rank: z.number().int().min(1),
  headline: z.string().min(1).max(200),
  summary: z.string().min(1).max(600),
  whyItMatters: z.string().min(1).max(600),
  category: GoodNewsCategory,
  sources: z.array(GoodNewsSourceSchema).min(1),
  publishedAt: z.string().optional(),
  /** Model confidence (0-1) that the claim is accurate and well-supported. */
  confidence: z.number().min(0).max(1),
  /** Short human-readable note on how the item was verified. */
  verification: z.string().min(1).max(400),
});
export type GoodNewsItem = z.infer<typeof GoodNewsItemSchema>;

/** The full daily digest persisted in Supabase and read by the page. */
export const GoodNewsDigestSchema = z.object({
  /** ISO date (YYYY-MM-DD) the digest represents. */
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  items: z.array(GoodNewsItemSchema).max(10),
  /** ISO timestamp the digest was generated. */
  generatedAt: z.string(),
  /** Model id used for the fact-check stage. */
  model: z.string(),
  meta: z.record(z.string(), z.unknown()).optional(),
});
export type GoodNewsDigest = z.infer<typeof GoodNewsDigestSchema>;

/**
 * LLM extraction output: candidate stories clustered from raw search results.
 * Sources are referenced by URL only; tiers/domains are resolved deterministically.
 */
export const CandidateItemSchema = z.object({
  headline: z.string().min(1).max(200),
  summary: z.string().min(1).max(600),
  /** The single concrete, checkable factual claim this story rests on. */
  claim: z.string().min(1).max(400),
  category: GoodNewsCategory,
  /** URLs (from the provided set) that report this same story. */
  sourceUrls: z.array(z.string().url()).min(1),
  /** True if the story is forward-looking/speculative rather than an accomplished fact. */
  isSpeculative: z.boolean().default(false),
});
export type CandidateItem = z.infer<typeof CandidateItemSchema>;

export const CandidateExtractionSchema = z.object({
  candidates: z.array(CandidateItemSchema).max(40),
});
export type CandidateExtraction = z.infer<typeof CandidateExtractionSchema>;

/**
 * LLM fact-check output for a single candidate. The model confirms (or rejects)
 * that the claim is supported by the supplied source text.
 */
export const FactCheckResultSchema = z.object({
  headline: z.string().min(1).max(200),
  summary: z.string().min(1).max(600),
  whyItMatters: z.string().min(1).max(600),
  category: GoodNewsCategory,
  /** Whether the claim is fully supported by the provided sources (no speculation/opinion). */
  isSupported: z.boolean(),
  confidence: z.number().min(0).max(1),
  verification: z.string().min(1).max(400),
  /** Subset of provided source URLs that genuinely support the claim. */
  supportingUrls: z.array(z.string().url()),
});
export type FactCheckResult = z.infer<typeof FactCheckResultSchema>;
