import { z } from "zod";

/**
 * How hard Arcadia works to compile **user** memory (planner + Mem0 + optional portrait)
 * before the main LLM turn. Does not change the 50k thread-history window.
 *
 * Omitted on the chat request → legacy rewriter path.
 */
export const CONTEXT_EFFORT_LEVELS = ["instant", "quick", "heavy"] as const;

export type ContextEffortLevel = (typeof CONTEXT_EFFORT_LEVELS)[number];

export const ContextEffortLevelSchema = z.enum(CONTEXT_EFFORT_LEVELS);

/** Default when the beta control is on. Closest to today's Arcadia rewrite path. */
export const DEFAULT_CONTEXT_EFFORT: ContextEffortLevel = "quick";

export type ContextEffortBudget = {
  id: ContextEffortLevel;
  name: string;
  /** Hard wall-clock for the Arcadia memory phase; late work is dropped. */
  budgetMs: number;
  /** Planner LLM timeout. `null` skips the planner (instant). */
  plannerTimeoutMs: number | null;
  overfetch: number;
  injectCap: number;
  /** Combined portrait + memory bullets + inventory, after formatting. */
  combinedTokenCap: number;
  includeProfile: boolean;
  profileMaxSections: number;
  /** Heavier portrait: more items / longer bodies per section. */
  profileRich: boolean;
  /** First-pass portrait token cap before pack trim. */
  profileTokenCap: number;
  /** Heavy second-pass: only if remaining time exceeds this. `0` disables. */
  secondPassMinRemainingMs: number;
};

export const CONTEXT_EFFORT_BUDGETS: Record<ContextEffortLevel, ContextEffortBudget> = {
  instant: {
    id: "instant",
    name: "Instant",
    budgetMs: 250,
    plannerTimeoutMs: null,
    overfetch: 8,
    injectCap: 5,
    combinedTokenCap: 400,
    includeProfile: false,
    profileMaxSections: 0,
    profileRich: false,
    profileTokenCap: 0,
    secondPassMinRemainingMs: 0,
  },
  quick: {
    id: "quick",
    name: "Quick",
    budgetMs: 1_000,
    plannerTimeoutMs: 350,
    overfetch: 28,
    injectCap: 20,
    combinedTokenCap: 2_500,
    includeProfile: true,
    profileMaxSections: 2,
    profileRich: false,
    profileTokenCap: 400,
    secondPassMinRemainingMs: 0,
  },
  heavy: {
    id: "heavy",
    name: "Heavy",
    budgetMs: 5_000,
    plannerTimeoutMs: 1_200,
    overfetch: 40,
    injectCap: 36,
    combinedTokenCap: 6_000,
    includeProfile: true,
    profileMaxSections: 6,
    profileRich: true,
    profileTokenCap: 1_500,
    secondPassMinRemainingMs: 800,
  },
};

/** Typical Mem0 hits when effort is omitted (legacy Arcadia / main chat estimate). */
export const LEGACY_ESTIMATED_MEMORY_CONTEXT_TOKENS = 900;

export function getContextEffortBudget(level: ContextEffortLevel): ContextEffortBudget {
  return CONTEXT_EFFORT_BUDGETS[level];
}

export function estimatedMemoryContextTokensForEffort(
  level: ContextEffortLevel | undefined
): number {
  if (!level) return LEGACY_ESTIMATED_MEMORY_CONTEXT_TOKENS;

  return CONTEXT_EFFORT_BUDGETS[level].combinedTokenCap;
}

export function contextEffortToIndex(level: ContextEffortLevel): number {
  const index = CONTEXT_EFFORT_LEVELS.indexOf(level);

  return index < 0 ? CONTEXT_EFFORT_LEVELS.indexOf(DEFAULT_CONTEXT_EFFORT) : index;
}

export function contextEffortFromIndex(index: number): ContextEffortLevel {
  const clamped = Math.max(0, Math.min(CONTEXT_EFFORT_LEVELS.length - 1, Math.round(index)));

  return CONTEXT_EFFORT_LEVELS[clamped] ?? DEFAULT_CONTEXT_EFFORT;
}

export function parseContextEffortLevel(raw: string | undefined): ContextEffortLevel | undefined {
  if (raw === undefined || raw === null) return undefined;
  const normalized = raw.trim().toLowerCase();

  if (normalized === "instant" || normalized === "quick" || normalized === "heavy") {
    return normalized;
  }

  return undefined;
}

export type ContextEffortRequestParams = {
  experience?: string | null;
  memoryEnabled: boolean;
  experimentalContextEffort?: boolean;
  contextEffortLevel?: ContextEffortLevel;
};

/**
 * Field to send on Arcadia chat / context-budget POSTs.
 * Omitted unless the beta is on, experience is Arcadia, and Memory is on.
 */
export function contextEffortForRequest(
  params: ContextEffortRequestParams
): ContextEffortLevel | undefined {
  if (!params.experimentalContextEffort) return undefined;
  if (params.experience !== "arcadia") return undefined;
  if (!params.memoryEnabled) return undefined;

  return params.contextEffortLevel ?? DEFAULT_CONTEXT_EFFORT;
}
