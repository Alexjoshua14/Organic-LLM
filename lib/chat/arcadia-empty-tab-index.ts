/** Number of Arcadia chat-style toggles on an empty thread. */
export const ARCADIA_CHAT_STYLE_TAB_CYCLE = 4;

/**
 * Which chat-style toggle (0–3) is active at tab-sequence position `n`.
 * Loops every four stops: 0→0, 1→1, 2→2, 3→3, 4→0, 5→1, …
 */
export function arcadiaEmptyStyleFocusIndex(sequenceIndex: number): number {
  return sequenceIndex % ARCADIA_CHAT_STYLE_TAB_CYCLE;
}
