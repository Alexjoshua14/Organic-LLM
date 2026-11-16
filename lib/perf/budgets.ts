import type { PerfJourneyId } from "./journeys";

/**
 * Timing targets the admin dashboard judges measurements against. One default, with room for
 * per-journey overrides; no journey has one yet. Do not tighten or loosen a target to make a
 * number look better: change it here, with the reason, so the history stays honest.
 *
 * 250 ms is the owner's "feels instant" line (docs/design/README.md: functional motion stays
 * brief; the app's performance budget).
 */
export const PERF_DEFAULT_BUDGET_MS = 250;

export const PERF_BUDGET_OVERRIDES: Partial<Record<PerfJourneyId, number>> = {};

export function perfBudgetFor(journey: PerfJourneyId): number {
  return PERF_BUDGET_OVERRIDES[journey] ?? PERF_DEFAULT_BUDGET_MS;
}

/** A percentile from fewer samples than this is shown as unreliable, not as a number. */
export const PERF_MIN_SAMPLES_P95 = 20;
export const PERF_MIN_SAMPLES_P99 = 100;
