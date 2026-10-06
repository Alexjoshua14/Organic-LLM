/** Shared types for the Noesis admin demo engine (isomorphic — safe on client + server). */

/** One message in a demo transcript. */
export type DemoTurn = {
  role: "user" | "assistant";
  text: string;
};

/** Token usage for a demo run, summed across every LLM call (spark + NPC turns). */
export type DemoUsage = {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
};

/** Zeroed usage accumulator. */
export function emptyDemoUsage(): DemoUsage {
  return { inputTokens: 0, outputTokens: 0, totalTokens: 0 };
}

/**
 * Fold one call's reported usage into a running total. Falls back to
 * `input + output` when a provider omits `totalTokens`.
 */
export function addUsage(
  running: DemoUsage,
  next: { inputTokens?: number | null; outputTokens?: number | null; totalTokens?: number | null }
): DemoUsage {
  const input = numberOrZero(next.inputTokens);
  const output = numberOrZero(next.outputTokens);
  const total = numberOrZero(next.totalTokens) || input + output;

  return {
    inputTokens: running.inputTokens + input,
    outputTokens: running.outputTokens + output,
    totalTokens: running.totalTokens + total,
  };
}

function numberOrZero(value: number | null | undefined): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}
