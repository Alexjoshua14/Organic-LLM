import type { LanguageModel } from "ai";

/** Shared with chat and Strata title pipelines — keep in sync with product defaults. */
export const TITLE_PIPELINE_SUMMARIZER_MODEL: LanguageModel = "google/gemini-3-flash";

export const TITLE_PIPELINE_SHORT_TITLE_MODEL: LanguageModel = "anthropic/claude-opus-4.6";

/**
 * Ultra-cheap model for browser tab labels only (~$0.075/M in, ~$0.30/M out on Gemini 2.5 Flash Lite).
 * See `lib/rate-limit/llm-cost.ts` for pricing used in post-call cost guards.
 */
export const BROWSER_TAB_TITLE_MODEL: LanguageModel = "google/gemini-2.5-flash-lite";
