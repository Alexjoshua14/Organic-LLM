/**
 * Organic LLM tiering — the contract harnesses and orchestrators build against (Organic mode,
 * subagent model choice). Each model gets an **Organic score**: Organic's own aggregate of
 * published benchmarks. Tiers come from that score, so model choice stays provider-agnostic.
 *
 * The scoring data and methodology live beside this file; `/sandbox/leaderboard` renders them.
 * Until a model has enough sourced data it is unscored (`organicScore: null`, `tier: null`) —
 * never guessed.
 */

/** Highest first. `frontier` is the top tier Organic mode requires of its orchestrator. */
export const ORGANIC_TIERS = ["frontier", "advanced", "capable", "light"] as const;

export type OrganicTier = (typeof ORGANIC_TIERS)[number];

export type OrganicModelScore = {
  /** Gateway model id, e.g. `anthropic/claude-sonnet-…`. */
  modelId: string;
  /** 0–100 on Organic's metric; null when unscored. */
  organicScore: number | null;
  tier: OrganicTier | null;
};

/** Every catalog model with its Organic score and tier, best first (unscored last). */
export function listModelScores(): ReadonlyArray<OrganicModelScore> {
  return [];
}

export function getModelTier(modelId: string): OrganicTier | null {
  return listModelScores().find((m) => m.modelId === modelId)?.tier ?? null;
}

/** True when `tier` is at least `minimum` (e.g. `meetsTier("frontier", "advanced")`). */
export function meetsTier(tier: OrganicTier | null, minimum: OrganicTier): boolean {
  return tier !== null && ORGANIC_TIERS.indexOf(tier) <= ORGANIC_TIERS.indexOf(minimum);
}
