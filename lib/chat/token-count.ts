import type { UIMessage } from "ai";

import { draftTokenText, getMessageTextForTokenEstimate } from "@/lib/chat/context-budget";
import { estimateTokenCountSync } from "@/lib/chat/tokenizer";

/**
 * Synchronous counts built on {@link estimateTokenCountSync}, for server code and tests. Client
 * components count in the background instead (`lib/chat/background-token-counter.ts`).
 */

/** Tokens the typed draft adds on send, framed as a user turn like packed thread messages. */
export function estimateDraftTokens(draftText: string): number {
  return estimateTokenCountSync(draftTokenText(draftText));
}

/** Text tokens one message adds to the model's history: the Arcadia send path's counter. */
export function messageTextTokenCountSync(message: UIMessage): number {
  return estimateTokenCountSync(getMessageTextForTokenEstimate(message));
}
