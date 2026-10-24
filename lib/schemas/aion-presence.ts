import { z } from "zod";

/**
 * Which thread a new presence session attaches to. Mirrors Speak's provisional
 * `resume-latest` default so the continuity question changes one value, not the mechanism.
 */
export const AionThreadPolicySchema = z.enum(["resume-latest", "new"]);

export type AionThreadPolicy = z.infer<typeof AionThreadPolicySchema>;

export const DEFAULT_AION_THREAD_POLICY: AionThreadPolicy = "resume-latest";

/** `threads.feature` for Aion presence conversations. */
export const AION_THREAD_FEATURE = "aion";

export const AION_THREAD_PATH = "/sandbox/aion";

/** `metadata.source` stamped on every presence turn persisted to `messages`. */
export const AION_PRESENCE_TURN_SOURCE = "aion-presence";

/**
 * Turn cost tiers. Tier 0 is free (ledger only); tier 1 is a cheap micro-turn;
 * tier 2 is a full tool-using chat turn.
 */
export const AionTurnTierSchema = z.enum(["none", "micro", "full"]);

export type AionTurnTier = z.infer<typeof AionTurnTierSchema>;

export const AionEventKindSchema = z.enum([
  "message",
  "ui.action",
  "ui.select",
  "button",
  "system",
  "callback",
  "voice.transcript",
]);

export type AionEventKind = z.infer<typeof AionEventKindSchema>;

export const AionEventSchema = z.object({
  id: z.string().uuid(),
  kind: AionEventKindSchema,
  /** Which surface emitted the event (composer, event-bench, speak, …). */
  surface: z.string().trim().min(1).max(64),
  /** Short human label for the HUD and ledger ("clicked Save", "opened card"). */
  label: z.string().trim().min(1).max(200),
  /** Optional structured payload; kept small so it can travel in the prompt. */
  payload: z.record(z.string(), z.unknown()).optional(),
  at: z.number().int().nonnegative(),
});

export type AionEvent = z.infer<typeof AionEventSchema>;

/** Orb / AdaptiveOrganicPresence phase driven by the presence provider. */
export const AionPresencePhaseSchema = z.enum(["idle", "active", "thinking", "responding"]);

export type AionPresencePhase = z.infer<typeof AionPresencePhaseSchema>;

export const AionPresenceBudgetSnapshotSchema = z.object({
  dailyTurnCap: z.number(),
  dailyTurnsRemaining: z.number(),
  dailyTurnsUsed: z.number(),
  dailyCostCapUsd: z.number(),
  dailyCostUsedUsd: z.number(),
  dailyCostRemainingUsd: z.number(),
  perMinuteCap: z.number(),
  perMinuteRemaining: z.number(),
  enabled: z.boolean(),
});

export type AionPresenceBudgetSnapshot = z.infer<typeof AionPresenceBudgetSnapshotSchema>;

/** Compact ledger entries the client may send with a micro-turn request. */
export const AionLedgerEntrySchema = z.object({
  kind: AionEventKindSchema,
  label: z.string().trim().min(1).max(200),
  at: z.number().int().nonnegative(),
});

export type AionLedgerEntry = z.infer<typeof AionLedgerEntrySchema>;

export const AionEventRequestSchema = z.object({
  event: AionEventSchema,
  /** Explicit thread from the client; honoured only when the caller owns it. */
  threadId: z.string().uuid().optional().nullable(),
  threadPolicy: AionThreadPolicySchema.optional().default(DEFAULT_AION_THREAD_POLICY),
  /** Recent Tier-0 events the model should know about without having paid for them. */
  ledger: z.array(AionLedgerEntrySchema).max(20).optional().default([]),
  memory: z.boolean().optional().default(false),
  /** Optional model override; defaults to the cheap presence model. */
  modelId: z.string().optional(),
});

export type AionEventRequest = z.infer<typeof AionEventRequestSchema>;

export const AionEventResponseSchema = z.object({
  /** Null when the model replied `[silent]` or the budget denied a turn. */
  text: z.string().nullable(),
  silent: z.boolean(),
  threadId: z.string().uuid().nullable(),
  resumed: z.boolean().optional(),
  budget: AionPresenceBudgetSnapshotSchema.optional(),
  /** Estimated input/output tokens for the HUD. */
  usage: z
    .object({
      inputTokens: z.number().optional(),
      outputTokens: z.number().optional(),
      totalTokens: z.number().optional(),
      durationMs: z.number().optional(),
      modelId: z.string().optional(),
      costUsd: z.number().optional(),
    })
    .optional(),
  error: z.string().optional(),
});

export type AionEventResponse = z.infer<typeof AionEventResponseSchema>;
