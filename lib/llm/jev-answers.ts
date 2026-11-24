import type { Experimental_DecisionQuestion } from "ai";

/**
 * Readers for Jev decision answers. Dependency-free so client-imported modules (the Auto model
 * router) can read answers without bundling the Gateway provider or the logger.
 */

export type JevQuestions = Record<string, Experimental_DecisionQuestion>;

export type JevChoice<K extends string> = {
  choice: K;
  /** Every option Jev scored, as returned (TypeSafe rounds; sums may be 0.99). */
  probabilities: Partial<Record<K, number>>;
};

/** Reads a choice answer, or null when the selected key is not one of `keys`. */
export function readJevChoice<K extends string>(
  answer: unknown,
  keys: readonly K[]
): JevChoice<K> | null {
  const raw = answer as { choice?: unknown; probabilities?: unknown } | undefined;
  const choice = raw?.choice;

  if (typeof choice !== "string" || !(keys as readonly string[]).includes(choice)) return null;
  const probabilities: Partial<Record<K, number>> = {};

  if (raw?.probabilities && typeof raw.probabilities === "object") {
    for (const [key, value] of Object.entries(raw.probabilities as Record<string, unknown>)) {
      if ((keys as readonly string[]).includes(key) && typeof value === "number") {
        probabilities[key as K] = Math.min(1, Math.max(0, value));
      }
    }
  }

  return { choice: choice as K, probabilities };
}

/** P(true) from a boolean answer, or null when absent. */
export function readJevProbability(answer: unknown): number | null {
  const value = (answer as { probability?: unknown } | undefined)?.probability;

  return typeof value === "number" && Number.isFinite(value)
    ? Math.min(1, Math.max(0, value))
    : null;
}
