import type { LanguageModel } from "ai";

/** Fast, cheap model for rabbit-hole memory context synthesis. */
export const RABBIT_HOLE_MEMORY_CONTEXT_MODEL: LanguageModel =
  "google/gemini-2.5-flash-lite";

/** Warn when end-to-end memory context build exceeds this threshold (ms). */
export const RABBIT_HOLE_MEMORY_CONTEXT_WARN_MS = 250;

/** Mem0 retrieve limit before LLM synthesis (latency vs recall). */
export const RABBIT_HOLE_MEMORY_SEARCH_LIMIT = 14;

/** Max memory bullets passed to the synthesis LLM. */
export const RABBIT_HOLE_MEMORY_SYNTHESIS_CAP = 8;
