/**
 * Milestones for refreshing encrypted `thread_summaries` and gating initial title generation.
 * Exchange count is inferred as floor(persistedMessageCount / 2), assuming user/assistant turns.
 */

export function exchangeCountFromPersistedMessageCount(persistedMessageCount: number): number {
  return Math.floor(Math.max(0, persistedMessageCount) / 2);
}

/** After exchanges 1 and 3, then every 5th exchange (5, 10, 15, …). */
export function shouldRefreshSummary(exchangeCount: number): boolean {
  if (exchangeCount < 1) return false;
  if (exchangeCount === 1 || exchangeCount === 3) return true;
  if (exchangeCount >= 5 && exchangeCount % 5 === 0) return true;

  return false;
}

/** First full exchange = at least two persisted messages (typical user + assistant). */
export function shouldAttemptInitialTitle(params: {
  persistedMessageCount: number;
  threadAlreadyHasTitle: boolean;
}): boolean {
  return !params.threadAlreadyHasTitle && params.persistedMessageCount >= 2;
}
