/** Sentinel: resolved on the server before any gateway / streamText call. */
export const AUTO_CHAT_MODEL_ID = "organic-llm/auto" as const;

/** Non-Delphi `AUTO_CHAT_MODEL_ID` resolves to this gateway id (single policy knob). */
export const AUTO_RESOLVED_SONNET_MODEL_ID = "anthropic/claude-sonnet-5" as const;
