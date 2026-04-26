import type { MemoryItemType } from "@/lib/schemas/memory";

/** Mem0 semantic search over-fetch for Arcadia bootstrap (single round-trip). */
export const ARCADIA_MEMORY_OVERFETCH = 28;

/** Minimum relevance score to inject a memory into the prompt (has score only). */
export const ARCADIA_MEMORY_MIN_SCORE = 0.25;

export const ARCADIA_MEMORY_MAX_INJECTED = 10;

/** Tool path: at least this many hits requested from Mem0 before slicing to tool `limit`. */
export const MEMORY_TOOL_OVERFETCH_MIN = 28;

export const MEMORY_TOOL_OVERFETCH_CAP = 40;

export type MemoryTierCounts = {
  /** Score strictly greater than 0.7 */
  tier1: number;
  /** Score in (0.4, 0.7] */
  tier2: number;
  /** Score in (minScore, 0.4] */
  tier3: number;
  /** Score defined and <= minScore */
  belowThreshold: number;
  /** No finite numeric score from Mem0 */
  noScore: number;
  sampleSize: number;
};

export type MemorySearchInventory = {
  tier1: number;
  tier2: number;
  tier3: number;
  belowThresholdInSample: number;
  noScoreInSample: number;
  sampleSize: number;
  retrievedLimit: number;
  injectedCap: number;
};

function finiteScore(score: unknown): number | undefined {
  if (typeof score !== "number" || !Number.isFinite(score)) return undefined;

  return score;
}

/**
 * Tier boundaries (exclusive upper where noted):
 * - tier1: score > 0.7 (so 0.7 is tier2)
 * - tier2: 0.4 < score <= 0.7
 * - tier3: minScore < score <= 0.4
 * - belowThreshold: score <= minScore (requires defined score)
 * - noScore: missing / non-finite score
 */
export function bucketMemoriesByTier(
  memories: MemoryItemType[],
  minScore: number
): MemoryTierCounts {
  let tier1 = 0;
  let tier2 = 0;
  let tier3 = 0;
  let belowThreshold = 0;
  let noScore = 0;

  for (const m of memories) {
    const s = finiteScore(m.score);

    if (s === undefined) {
      noScore += 1;
      continue;
    }

    if (s <= minScore) {
      belowThreshold += 1;
    } else if (s > 0.7) {
      tier1 += 1;
    } else if (s > 0.4) {
      tier2 += 1;
    } else {
      tier3 += 1;
    }
  }

  return {
    tier1,
    tier2,
    tier3,
    belowThreshold,
    noScore,
    sampleSize: memories.length,
  };
}

export function passesMinScoreForInjection(m: MemoryItemType, minScore: number): boolean {
  const s = finiteScore(m.score);

  if (s === undefined) return true;

  return s >= minScore;
}

/**
 * Highest-scoring memories first; items without score sort as 1.0 so they stay competitive.
 */
export function selectMemoriesForPrompt(
  memories: MemoryItemType[],
  options: { maxIncluded: number; minScore: number }
): MemoryItemType[] {
  const { maxIncluded, minScore } = options;
  const filtered = memories.filter((m) => passesMinScoreForInjection(m, minScore));
  const sorted = [...filtered].sort((a, b) => {
    const sa = finiteScore(a.score) ?? 1;
    const sb = finiteScore(b.score) ?? 1;

    return sb - sa;
  });

  return sorted.slice(0, maxIncluded);
}

export function formatMemoriesForPrompt(memories: MemoryItemType[]): string {
  if (memories.length === 0) return "";

  return memories.map((m) => `- ${m.memory}`).join("\n");
}

export function toMemorySearchInventory(
  tiers: MemoryTierCounts,
  retrievedLimit: number,
  injectedCap: number
): MemorySearchInventory {
  return {
    tier1: tiers.tier1,
    tier2: tiers.tier2,
    tier3: tiers.tier3,
    belowThresholdInSample: tiers.belowThreshold,
    noScoreInSample: tiers.noScore,
    sampleSize: tiers.sampleSize,
    retrievedLimit,
    injectedCap,
  };
}

export function buildArcadiaMemoryInventoryText(params: {
  conversationMessagesInContext: number;
  memoriesInjected: number;
  tiers: MemoryTierCounts;
  overfetchCap: number;
  minScore: number;
  queryRewriteUsed?: boolean;
  effectiveQueryCount?: number;
}): string {
  const { tiers, minScore } = params;
  const rewriteLine =
    params.queryRewriteUsed !== undefined && params.effectiveQueryCount !== undefined
      ? `Query rewrite: ${params.queryRewriteUsed ? "on" : "off"}. Effective queries: ${params.effectiveQueryCount}.`
      : null;

  return [
    `Conversation messages in this request (including your latest user message): ${params.conversationMessagesInContext}.`,
    `Injected memories for this turn: ${params.memoriesInjected} (cap ${ARCADIA_MEMORY_MAX_INJECTED}).`,
    ...(rewriteLine ? [rewriteLine] : []),
    `Semantic search sample: ${tiers.sampleSize} hit(s) among the top-${params.overfetchCap} retrieved for this query.`,
    `Relevance tiers in that sample — tier 1 (score > 0.7): ${tiers.tier1}; tier 2 (0.4 < score ≤ 0.7): ${tiers.tier2}; tier 3 (${minScore} < score ≤ 0.4): ${tiers.tier3}; at or below minimum score (≤ ${minScore}): ${tiers.belowThreshold}; without score: ${tiers.noScore}.`,
    `Counts are only within this sample, not your entire memory store. Call search_memories if you likely need more.`,
  ].join(" ");
}
