import { z } from "zod";

import { StageTurnSettingsSchema, emptyStageState, type StageState } from "@/lib/stage/schema";

/** Actions Jev may rank. LLM tools + Stage's full surface as direct tools. */
export const JevStageActionKindSchema = z.enum([
  "respond",
  "orchestrate",
  "memory_search",
  "web_search",
  "view_switch",
  "captures",
  "recall",
  "designer_brief",
  "specialists",
]);

export type JevStageActionKind = z.infer<typeof JevStageActionKindSchema>;

export const JevStageCandidateSchema = z.object({
  kind: JevStageActionKindSchema,
  confidence: z.number().min(0).max(1),
  reason: z.string().max(240),
  /** Free-form args Jev proposes for the chosen tool. Validated per executor. */
  args: z.record(z.string(), z.unknown()).default({}),
});

export type JevStageCandidate = z.infer<typeof JevStageCandidateSchema>;

export const JevStageRouteSchema = z.object({
  candidates: z.array(JevStageCandidateSchema).min(1).max(12),
});

export type JevStageRoute = z.infer<typeof JevStageRouteSchema>;

export const JevStageModelCallTraceSchema = z.object({
  id: z.string().min(1),
  operation: z.string().min(1),
  model: z.string().min(1),
  inputTokens: z.number().int().nonnegative(),
  outputTokens: z.number().int().nonnegative(),
  cachedInputTokens: z.number().int().nonnegative().default(0),
  costUsd: z.number().nonnegative(),
  latencyMs: z.number().nonnegative(),
  timeToFirstTokenMs: z.number().nonnegative().nullable().default(null),
  tokensPerSecond: z.number().nonnegative().nullable().default(null),
});

export type JevStageModelCallTrace = z.infer<typeof JevStageModelCallTraceSchema>;

export const JevStageTurnEvalSchema = z.object({
  signal: z.enum(["up", "down"]).nullable().default(null),
  note: z.string().max(500).nullable().default(null),
});

export type JevStageTurnEval = z.infer<typeof JevStageTurnEvalSchema>;

/** One tool call inside an LLM hop step, summarized for the insight timeline. */
export const JevStageToolTraceSchema = z.object({
  name: z.string(),
  args: z.string(),
  result: z.string().nullable(),
  /** Execution time when the tool was timed (wrapped); null for step-only records. */
  ms: z.number().nonnegative().nullable().optional(),
  ok: z.boolean().optional(),
  /** Stage state this tool changed ("View switched"), when it is an effect tool. */
  effect: z.string().nullable().optional(),
  /** Full tool output as sent back to the model (capped), for the Context tab. */
  output: z.string().optional(),
});

/** One piece of what a model hop was sent, in prompt order. */
export const JevStageContextSegmentSchema = z.object({
  kind: z.enum([
    "system",
    "question",
    "summary",
    "knowledge",
    "space",
    "specialists",
    "history",
    "tools",
    "user",
  ]),
  label: z.string(),
  role: z.string().nullable(),
  /** Estimated tokens (chars / 4); providers report only the hop's total. */
  tokens: z.number().int().nonnegative(),
  preview: z.string(),
  text: z.string(),
  truncated: z.boolean(),
});

export type JevStageContextSegment = z.infer<typeof JevStageContextSegmentSchema>;

export const JevStageContextManifestSchema = z.object({
  segments: z.array(JevStageContextSegmentSchema),
  /** History packed under the Respond input budget; null when the hop sends no history. */
  window: z
    .object({
      budgetUsd: z.number().nonnegative().nullable(),
      total: z.number().int().nonnegative(),
      kept: z.number().int().nonnegative(),
      dropped: z.number().int().nonnegative(),
    })
    .nullable(),
});

export type JevStageContextManifest = z.infer<typeof JevStageContextManifestSchema>;

export type JevStageToolTrace = z.infer<typeof JevStageToolTraceSchema>;

/** One AI SDK step of a Respond / Orchestrate hop. */
export const JevStageHopStepSchema = z.object({
  index: z.number().int().nonnegative(),
  ms: z.number().nonnegative(),
  tools: z.array(JevStageToolTraceSchema),
  inputTokens: z.number().int().nonnegative(),
  outputTokens: z.number().int().nonnegative(),
  cachedInputTokens: z.number().int().nonnegative(),
  costUsd: z.number().nonnegative(),
  finishReason: z.string().nullable(),
});

export type JevStageHopStep = z.infer<typeof JevStageHopStepSchema>;

export const JevStageActionViaSchema = z.enum(["jev", "floor", "jev_error", "blocked"]);

export type JevStageActionVia = z.infer<typeof JevStageActionViaSchema>;

/**
 * Pipeline trace for one turn. Emitted live over the NDJSON stream as each stage happens and
 * stored on the turn insight, so past turns replay the same view. `t` is ms since turn start.
 */
export const JevStageTraceEventSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("jev.start"), t: z.number().nonnegative() }),
  z.object({
    kind: z.literal("jev.end"),
    t: z.number().nonnegative(),
    ms: z.number().nonnegative(),
    source: z.enum(["jev", "fallback"]),
    /** Every action with Jev's probability, highest first. Empty when Jev failed. */
    distribution: z.array(z.object({ kind: JevStageActionKindSchema, p: z.number().min(0).max(1) })),
    choice: JevStageActionKindSchema.nullable(),
    floor: z.number().min(0).max(1),
    /** True when a non-respond top pick was below the floor, so the turn fell back to Respond. */
    belowFloor: z.boolean(),
    error: z.string().nullable(),
    inputTokens: z.number().int().nonnegative(),
    outputTokens: z.number().int().nonnegative(),
    costUsd: z.number().nonnegative(),
  }),
  z.object({
    kind: z.literal("action"),
    t: z.number().nonnegative(),
    action: JevStageActionKindSchema,
    via: JevStageActionViaSchema,
    reason: z.string(),
  }),
  z.object({
    kind: z.literal("hop.start"),
    t: z.number().nonnegative(),
    hopId: z.string().min(1),
    operation: z.enum(["respond", "orchestrate", "direct"]),
    action: JevStageActionKindSchema,
    model: z.string().nullable(),
  }),
  z.object({
    kind: z.literal("hop.first_token"),
    t: z.number().nonnegative(),
    hopId: z.string().min(1),
  }),
  z.object({
    /** What a hop was sent. hopId "jev" is the Jev decision. Stored only in the prototype record. */
    kind: z.literal("hop.context"),
    t: z.number().nonnegative(),
    hopId: z.string().min(1),
    model: z.string(),
    manifest: JevStageContextManifestSchema,
  }),
  z.object({
    kind: z.literal("hop.tool"),
    t: z.number().nonnegative(),
    hopId: z.string().min(1),
    tool: JevStageToolTraceSchema,
  }),
  z.object({
    kind: z.literal("hop.step"),
    t: z.number().nonnegative(),
    hopId: z.string().min(1),
    step: JevStageHopStepSchema,
  }),
  z.object({
    kind: z.literal("hop.end"),
    t: z.number().nonnegative(),
    hopId: z.string().min(1),
    ms: z.number().nonnegative(),
    ok: z.boolean(),
    call: JevStageModelCallTraceSchema.nullable(),
    note: z.string().nullable(),
  }),
  z.object({
    kind: z.literal("fallback"),
    t: z.number().nonnegative(),
    from: z.string(),
    to: z.string(),
    reason: z.string(),
  }),
  z.object({
    kind: z.literal("done"),
    t: z.number().nonnegative(),
    outcome: z.enum(["ok", "limit_error", "error"]),
    totals: z.object({
      inputTokens: z.number().int().nonnegative(),
      outputTokens: z.number().int().nonnegative(),
      cachedInputTokens: z.number().int().nonnegative(),
      costUsd: z.number().nonnegative(),
      latencyMs: z.number().nonnegative(),
    }),
  }),
]);

export type JevStageTraceEvent = z.infer<typeof JevStageTraceEventSchema>;

export const JevStageTurnInsightSchema = z.object({
  turnId: z.string().uuid(),
  at: z.string().datetime(),
  userMessage: z.string().max(8000),
  selected: JevStageCandidateSchema,
  candidates: z.array(JevStageCandidateSchema).min(1),
  fellBack: z.boolean(),
  fallbackReason: z.string().max(300).nullable().default(null),
  routerMs: z.number().nonnegative(),
  outcome: z.enum(["ok", "limit_error", "error"]),
  outcomeDetail: z.string().max(500).nullable().default(null),
  calls: z.array(JevStageModelCallTraceSchema).default([]),
  totals: z.object({
    inputTokens: z.number().int().nonnegative(),
    outputTokens: z.number().int().nonnegative(),
    cachedInputTokens: z.number().int().nonnegative(),
    costUsd: z.number().nonnegative(),
    latencyMs: z.number().nonnegative(),
  }),
  perModelSpendUsd: z.record(z.string(), z.number()).default({}),
  eval: JevStageTurnEvalSchema.default({ signal: null, note: null }),
  /** Pipeline trace; absent on records from before COA-755 (the view synthesizes one). */
  trace: z.array(JevStageTraceEventSchema).optional(),
});

export type JevStageTurnInsight = z.infer<typeof JevStageTurnInsightSchema>;

export const JevStageBundleSchema = z.object({
  stage: z.custom<StageState>((value) => !!value && typeof value === "object"),
  insights: z.array(JevStageTurnInsightSchema).default([]),
});

export type JevStageBundle = z.infer<typeof JevStageBundleSchema>;

export function emptyJevStageBundle(): JevStageBundle {
  return { stage: emptyStageState(), insights: [] };
}

export const JevStageTurnRequestSchema = z
  .object({
    message: z.string().trim().min(1).max(8000),
    requestId: z.string().uuid(),
    settings: StageTurnSettingsSchema.optional(),
  })
  .strict();

export type JevStageTurnRequest = z.infer<typeof JevStageTurnRequestSchema>;

/** Stream / NDJSON event envelope for the prototype client. */
export const JevStageStreamEventSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("heartbeat") }),
  z.object({
    type: z.literal("route"),
    turnId: z.string().uuid(),
    selected: JevStageCandidateSchema,
    candidates: z.array(JevStageCandidateSchema),
    fellBack: z.boolean(),
    fallbackReason: z.string().nullable(),
    routerMs: z.number(),
  }),
  z.object({
    type: z.literal("trace"),
    turnId: z.string().uuid(),
    event: JevStageTraceEventSchema,
  }),
  z.object({
    type: z.literal("patch"),
    stage: z.custom<StageState>((value) => !!value && typeof value === "object"),
  }),
  z.object({
    type: z.literal("delta"),
    text: z.string(),
  }),
  z.object({
    type: z.literal("limit_error"),
    message: z.string(),
  }),
  z.object({
    type: z.literal("error"),
    message: z.string(),
  }),
  z.object({
    type: z.literal("done"),
    insight: JevStageTurnInsightSchema,
    stage: z.custom<StageState>((value) => !!value && typeof value === "object"),
  }),
]);

export type JevStageStreamEvent = z.infer<typeof JevStageStreamEventSchema>;
