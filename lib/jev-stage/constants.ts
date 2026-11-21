/** Tunable confidence floor for selecting a Jev action (research follow-up). */
export const JEV_STAGE_CONFIDENCE_FLOOR = 0.55;

/** Respond tool: max USD of input context for the selected model. */
export const JEV_STAGE_RESPOND_INPUT_BUDGET_USD = 0.2;

/** Respond tool: max USD of output. Cap hits are visible errors in the prototype. */
export const JEV_STAGE_RESPOND_OUTPUT_BUDGET_USD = 0.1;

/** Soft ceiling so a cheap model cannot flood the context window. */
export const JEV_STAGE_MAX_CONTEXT_TOKENS = 100_000;

export const JEV_STAGE_MAX_OUTPUT_TOKENS_HARD = 8_000;

export const JEV_STAGE_ROUTER_TIMEOUT_MS = 2_500;

/** Keep a bounded insight history in the prototype snapshot. */
export const JEV_STAGE_MAX_TURN_INSIGHTS = 40;
