import { z } from "zod";

/**
 * Arcadia **Jev mode** contracts. Client-safe (zod only): the chat UI renders the persisted
 * `data-jev` part and the server re-reads it when the user overrides an acknowledgement.
 * See docs/architecture/decisions/20261001-arcadia-jev-mode.md.
 */

/**
 * Intent options Jev chooses between. Each one changes how the reply is written (see
 * `JEV_INTENTS` in `./questions`); intents that would not change the reply are merged, so the
 * list stays far below TypeSafe's 255-option ceiling.
 */
export const JEV_INTENT_KEYS = [
  "quick_answer",
  "explain",
  "research",
  "brainstorm",
  "decide",
  "plan",
  "write_edit",
  "code",
  "visualize",
  "deep_dive",
  "task_capture",
  "conversation",
  "feedback",
] as const;

export type JevIntentKey = (typeof JEV_INTENT_KEYS)[number];

export const JEV_RESPONSE_FORMATS = ["text", "voice", "tool_result"] as const;

export type JevResponseFormat = (typeof JEV_RESPONSE_FORMATS)[number];

/** Tool groups Jev can switch on or off for a turn. One group may cover several tools. */
export const JEV_TOOL_KEYS = [
  "web_search",
  "memory_search",
  "mermaid_diagram",
  "gen_ui",
  "restaurant_lookup",
  "rabbit_hole",
  "task_management",
  "chat_history",
] as const;

export type JevToolKey = (typeof JEV_TOOL_KEYS)[number];

/** Model tiers for Jev-assisted Auto routing. `standard` is today's Arcadia Auto pick. */
export const JEV_ROUTING_TIERS = ["reflex", "standard", "reasoning"] as const;

export type JevRoutingTier = (typeof JEV_ROUTING_TIERS)[number];

const Probability = z.number().min(0).max(1);

function choiceReadingSchema<const T extends readonly [string, ...string[]]>(keys: T) {
  return z.object({
    choice: z.enum(keys),
    confidence: Probability,
    probabilities: z.partialRecord(z.enum(keys), Probability),
  });
}

export const JevIntentReadingSchema = choiceReadingSchema(JEV_INTENT_KEYS);
export const JevResponseFormatReadingSchema = choiceReadingSchema(JEV_RESPONSE_FORMATS);

export type JevIntentReading = z.infer<typeof JevIntentReadingSchema>;
export type JevResponseFormatReading = z.infer<typeof JevResponseFormatReadingSchema>;

/**
 * What Jev concluded about the latest user message. `source: "fallback"` means Jev was not
 * reachable (or every pass failed); the turn then runs like Standard Arcadia.
 */
export const JevAnalysisSchema = z.object({
  source: z.enum(["jev", "fallback"]),
  /** Short code, never user content: `no_credentials`, `timeout`, `error`, `bad_response`. */
  fallbackReason: z.string().max(80).optional(),
  intent: JevIntentReadingSchema.nullable(),
  responseFormat: JevResponseFormatReadingSchema.nullable(),
  /** P(the message needs no reply). Acknowledge-only at ≥ `JEV_ACK_THRESHOLD`. */
  noReplyProbability: Probability.nullable(),
  /** P(the tool group would help this reply), per group. */
  toolProbabilities: z.partialRecord(z.enum(JEV_TOOL_KEYS), Probability).nullable(),
  /** Jev requests made for this message (more than one when it was split into chunks). */
  passes: z.number().int().min(0),
  failedPasses: z.number().int().min(0),
  /** Token count of the user message text. */
  messageTokens: z.number().int().min(0),
  durationMs: z.number().min(0),
});

export type JevAnalysis = z.infer<typeof JevAnalysisSchema>;

/** What the server did with the analysis for this turn. */
export const JevPlanSchema = z.object({
  respond: z.boolean(),
  responseFormat: z.enum(JEV_RESPONSE_FORMATS),
  /** Tool groups enabled for the LLM this turn, after the composer's Search/Memory toggles. */
  tools: z.array(z.enum(JEV_TOOL_KEYS)),
  /** True when the user pressed "Respond anyway" on an acknowledgement. */
  override: z.boolean(),
});

export type JevPlan = z.infer<typeof JevPlanSchema>;

/** Jev-assisted Auto model routing outcome (only when the composer model is Auto). */
export const JevModelRouteSchema = z.object({
  mode: z.enum(["on", "shadow"]),
  /** Tier Jev's answers pointed to; null when routing fell back without enough answers. */
  tier: z.enum(JEV_ROUTING_TIERS).nullable(),
  /** Model the turn ran on. In shadow mode this is the existing Auto pick. */
  modelId: z.string(),
  /** Model Jev would have picked (differs from `modelId` only in shadow mode). */
  jevModelId: z.string().nullable(),
  outcome: z.enum([
    "complete",
    "soft_deadline",
    "after_soft_deadline",
    "hard_deadline_partial",
    "fallback",
  ]),
  answered: z.number().int().min(0),
  asked: z.number().int().min(0),
  elapsedMs: z.number().min(0),
});

export type JevModelRoute = z.infer<typeof JevModelRouteSchema>;

export const JEV_TURN_DATA_VERSION = 1;

/** Payload of the persisted `data-jev` message part. */
export const JevTurnDataSchema = z.object({
  version: z.literal(JEV_TURN_DATA_VERSION),
  outcome: z.enum(["respond", "acknowledged"]),
  analysis: JevAnalysisSchema,
  plan: JevPlanSchema,
  route: JevModelRouteSchema.optional(),
});

export type JevTurnData = z.infer<typeof JevTurnDataSchema>;

/** UI message part type for {@link JevTurnData}. */
export const JEV_DATA_PART_TYPE = "data-jev" as const;

/** Reads the `data-jev` part from a message's parts, or null when absent or malformed. */
export function findJevTurnData(parts: ReadonlyArray<{ type: string }>): JevTurnData | null {
  for (const part of parts) {
    if (part.type !== JEV_DATA_PART_TYPE) continue;

    const parsed = JevTurnDataSchema.safeParse((part as { data?: unknown }).data);

    return parsed.success ? parsed.data : null;
  }

  return null;
}
