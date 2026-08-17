import type { LanguageModel } from "ai";

/** Shared with chat and Strata title pipelines — keep in sync with product defaults. */
export const TITLE_PIPELINE_SUMMARIZER_MODEL: LanguageModel = "google/gemini-3.1-flash-lite";

export const TITLE_PIPELINE_SHORT_TITLE_MODEL: LanguageModel = "anthropic/claude-opus-5";

/**
 * Cheap model for browser tab labels only (~$0.25/M in, ~$1.50/M out on Gemini 3.1 Flash Lite).
 * See `lib/rate-limit/llm-cost.ts` for pricing used in post-call cost guards.
 */
export const BROWSER_TAB_TITLE_MODEL: LanguageModel = "google/gemini-3.1-flash-lite";
