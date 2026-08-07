import type { LanguageModel } from "ai";

/** Max parent+child article nodes considered before reranking. */
export const RABBIT_HOLE_GRAPH_NODE_LIMIT = 100;

/** Default cap on reranked summaries passed into the generation prompt. */
export const RABBIT_HOLE_GRAPH_RERANKED_LIMIT_DEFAULT = 90;

/** Stored/generated per-node summary output cap (tokens). Cost ceiling ≈ limit × this / 1M × model rate. */
export const RABBIT_HOLE_NODE_SUMMARY_MAX_OUTPUT_TOKENS = 2000;

/** Fast model for node summary backfill and optional graph-context synthesis. */
export const RABBIT_HOLE_NODE_SUMMARY_MODEL: LanguageModel = "google/gemini-2.5-flash-lite";

/** Cohere rerank model when COHERE_API_KEY is set; lexical fallback otherwise. */
export const RABBIT_HOLE_GRAPH_RERANK_MODEL = "rerank-english-v3.0";
