/**
 * Arcadia Jev mode thresholds and budgets. Thresholds are provisional until calibrated against
 * logged turns — see the open questions in
 * docs/architecture/decisions/20261001-arcadia-jev-mode.md.
 */

/** Messages above this many tokens are refused before anything is saved or sent. */
export const JEV_MAX_INPUT_TOKENS = 1_000_000;

export const JEV_INPUT_TOO_LARGE_MESSAGE =
  "Input too large. Please try again with a smaller input.";

/**
 * Message tokens per Jev pass. Jev reads 32k tokens of state plus its longest question; a pass
 * also carries recent turns (≤ ~3k tokens) and the message's opening and closing frame
 * (≤ 2.5k tokens), so 20k leaves margin for tokenizer differences.
 */
export const JEV_CHUNK_TOKENS = 20_000;

/** Every pass over a split message also sees its opening and closing, where asks usually sit. */
export const JEV_FRAME_HEAD_TOKENS = 1_000;
export const JEV_FRAME_TAIL_TOKENS = 1_500;

/** Recent conversation sent with each pass, newest kept. */
export const JEV_RECENT_MESSAGES = 6;
export const JEV_RECENT_MESSAGE_CHARS = 1_500;
export const JEV_RECENT_TOTAL_CHARS = 9_000;

/** Parallel Jev passes for a split message (up to 50 passes at the 1M-token cap). */
export const JEV_ANALYSIS_CONCURRENCY = 6;

/** Per-pass timeout. A ~15k-token pass measured 400–510 ms; this is a failure bound, not a target. */
export const JEV_ANALYSIS_PASS_TIMEOUT_MS = 4_000;

/** Acknowledge without calling the LLM only at or above this P(no reply needed). */
export const JEV_ACK_THRESHOLD = 0.85;

/**
 * Enable a tool group at or above this probability. Low on purpose: a missing tool costs a bad
 * answer, an extra one costs a few prompt tokens — the LLM still decides whether to call it.
 */
export const JEV_TOOL_ENABLE_THRESHOLD = 0.35;

/** Voice or tool-only replies need at least this probability; otherwise the reply is text. */
export const JEV_FORMAT_SWITCH_MIN_PROBABILITY = 0.5;

/** Below this confidence the intent is reported as unclear instead of steering the reply. */
export const JEV_INTENT_MIN_CONFIDENCE = 0.4;

/** The quick reply sent instead of an LLM response. */
export const JEV_ACK_TEXT = "Acknowledged.";
