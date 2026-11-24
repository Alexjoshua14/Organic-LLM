import { JEV_STAGE_PHRASE_CONTEXT_CHARS } from "./constants";
import type { JevStageCandidate } from "./schema";

/** Lookup tools Respond may skip when a direct tool already supplied a digest. */
export type JevPhraseOmitTool = "search_memories" | "recall_memories" | "web_search";

/**
 * After a Stage-surface lookup, Respond phrases the user-facing reply from a lean digest
 * instead of ending on a status caption. Pure surface actions (view, clear, queue) do not.
 */
export function directToolNeedsPhrase(kind: JevStageCandidate["kind"]): boolean {
  return kind === "recall" || kind === "memory_search" || kind === "web_search";
}

/** Compact JSON for the phrase hop — enough to answer, not a second full retrieval. */
export function leanPhraseContext(
  tool: "recall" | "memory_search" | "web_search",
  payload: Record<string, unknown>
): string {
  return JSON.stringify({ tool, ...payload }).slice(0, JEV_STAGE_PHRASE_CONTEXT_CHARS);
}
