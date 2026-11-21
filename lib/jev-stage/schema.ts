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
