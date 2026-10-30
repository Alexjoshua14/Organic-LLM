import { z } from "zod";

import { StagePresentationSchema, StageViewCommandSchema } from "./view-schema";

import { ChatEffortLevelSchema } from "@/lib/schemas/chat-effort";
import { RecipeCardBlockSchema } from "@/lib/schemas/gen-ui/recipe-card";

export const STAGE_SIZE = 32;
// The grid covers the whole Stage, including the response and composer.
export const STAGE_HEADER_RECT = { x: 0, y: 0, w: 32, h: 3 } as const;
export const STAGE_CONTENT_RECT = { x: 8, y: 4, w: 24, h: 18 } as const;
export const STAGE_RESPONSE_RECT = { x: 8, y: 23, w: 24, h: 5 } as const;
export const STAGE_COMPOSER_RECT = { x: 8, y: 29, w: 24, h: 3 } as const;
export const STAGE_AGENT_RECT = { x: 0, y: 5, w: 7, h: 8 } as const;
export const STAGE_MAX_WIDGETS = 48;
export const STAGE_MAX_PENDING_DESIGNS = 8;
export const STAGE_MAX_SUBAGENTS = 2;
export const STAGE_SUBAGENT_RECT = { x: 0, y: 14, w: 7, h: 13 } as const;
export const STAGE_CHILD_RECTS = [
  { x: 0, y: 14, w: 7, h: 6 },
  { x: 0, y: 21, w: 7, h: 6 },
] as const;

export const StageRectSchema = z
  .object({
    x: z.number().int().min(0).max(31),
    y: z.number().int().min(0).max(31),
    w: z.number().int().min(1).max(32),
    h: z.number().int().min(1).max(32),
  })
  .strict()
  .refine(({ x, y, w, h }) => x + w <= STAGE_SIZE && y + h <= STAGE_SIZE);

const base = {
  id: z.string().uuid(),
  title: z.string().trim().min(1).max(100),
  rect: StageRectSchema,
  source: z.object({ id: z.string().uuid(), name: z.string().max(40) }).optional(),
};

export const StageWidgetSchema = z.discriminatedUnion("kind", [
  z.object({ ...base, kind: z.literal("note"), text: z.string().max(4000) }).strict(),
  z.object({ ...base, kind: z.literal("mermaid"), code: z.string().max(8000) }).strict(),
  z.object({ ...base, kind: z.literal("recipe"), recipe: RecipeCardBlockSchema }).strict(),
  z.object({ ...base, kind: z.literal("chat"), threadId: z.string().uuid() }).strict(),
]);
export type StageWidget = z.infer<typeof StageWidgetSchema>;
export type StageRect = z.infer<typeof StageRectSchema>;

export const StageMessageSchema = z
  .object({
    id: z.string().uuid(),
    role: z.enum(["user", "assistant"]),
    text: z.string().max(8000),
    author: z
      .object({ id: z.string().uuid(), name: z.string().max(40), kind: z.literal("subagent") })
      .optional(),
  })
  .strict();

export const StageDesignSchema = z
  .object({
    id: z.string().uuid(),
    status: z.enum(["working", "canceling", "failed"]),
    phase: z.enum(["queued", "working"]).optional(),
    slot: z.number().int().min(0).max(1).optional(),
    startedAt: z.string().datetime(),
    brief: z.string().max(2000),
    error: z.string().max(200).optional(),
  })
  .strict();

export const StageSubagentAssignmentSchema = z
  .object({
    name: z.string().trim().min(1).max(40),
    goal: z.string().trim().min(1).max(2000),
  })
  .strict();
export const StageSubagentSchema = StageSubagentAssignmentSchema.extend({
  id: z.string().uuid(),
  status: z.enum(["queued", "working", "canceling", "done", "canceled", "failed"]),
  startedAt: z.string().datetime(),
  result: z.string().max(6000).nullable(),
  slot: z.number().int().min(0).max(1).optional(),
  memory: z.boolean().default(false),
  webSearch: z.boolean().default(false),
});
export type StageSubagent = z.infer<typeof StageSubagentSchema>;
export type StageSubagentAssignment = z.infer<typeof StageSubagentAssignmentSchema>;
export function stageSubagentActive(agent: StageSubagent): boolean {
  return agent.status === "queued" || agent.status === "working" || agent.status === "canceling";
}

export const StageStateSchema = z
  .object({
    revision: z.number().int().nonnegative(),
    updatedAt: z.string().datetime(),
    subagents: z.array(StageSubagentSchema).max(STAGE_MAX_SUBAGENTS).optional(),
    widgets: z.array(StageWidgetSchema).max(STAGE_MAX_WIDGETS),
    messages: z.array(StageMessageSchema).max(24),
    summary: z.string().max(6000),
    viewCommand: StageViewCommandSchema.optional(),
    presentation: StagePresentationSchema.optional(),
    lastModel: z.string().max(100).nullable(),
    nextModel: z.string().max(100),
    design: StageDesignSchema.nullable(),
    pendingDesigns: z
      .array(z.object({ id: z.string().uuid(), brief: z.string().max(2000) }).strict())
      .max(STAGE_MAX_PENDING_DESIGNS)
      .default([]),
  })
  .strict();
export type StageState = z.infer<typeof StageStateSchema>;

export const StageOperationSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("upsert"), widget: StageWidgetSchema }).strict(),
  z.object({ type: z.literal("move"), id: z.string().uuid(), rect: StageRectSchema }).strict(),
  z.object({ type: z.literal("remove"), id: z.string().uuid() }).strict(),
]);
export type StageOperation = z.infer<typeof StageOperationSchema>;

export const StageMutationSchema = z
  .object({
    revision: z.number().int().nonnegative(),
    operations: z.array(StageOperationSchema).min(1).max(24),
  })
  .strict();

export const StageTurnSettingsSchema = z
  .object({
    model: z.string().max(100).optional(),
    effort: ChatEffortLevelSchema.optional(),
    webSearch: z.boolean().optional(),
    memory: z.boolean().optional(),
    speechFriendly: z.boolean().optional(),
    presentation: StagePresentationSchema.optional(),
  })
  .strict();
export type StageTurnSettings = z.infer<typeof StageTurnSettingsSchema>;

export const StageTurnSchema = z
  .object({
    message: z.string().trim().min(1).max(8000),
    settings: StageTurnSettingsSchema.optional(),
    requestId: z.string().uuid(),
  })
  .strict();

export const StageEventSchema = z
  .object({
    revision: z.number().int().positive(),
    at: z.string().datetime(),
    cause: z.enum([
      "turn",
      "view",
      "layout",
      "design-start",
      "design-complete",
      "design-failed",
      "turn-failed",
      "subagent-start",
      "subagent-complete",
      "subagent-cancel",
      "subagent-failed",
    ]),
    requestId: z.string().uuid().nullable(),
    lastModel: z.string().nullable(),
    nextModel: z.string(),
    usage: z
      .object({ inputTokens: z.number().nonnegative(), outputTokens: z.number().nonnegative() })
      .nullable(),
    call: z
      .object({
        operation: z.enum(["turn", "design", "subagent"]),
        model: z.string(),
        outcome: z.enum(["complete", "failed", "superseded"]),
      })
      .nullable()
      .default(null),
    bundle: StageStateSchema,
  })
  .strict();
export type StageEvent = z.infer<typeof StageEventSchema>;

export function emptyStageState(): StageState {
  return {
    revision: 0,
    updatedAt: new Date().toISOString(),
    widgets: [],
    messages: [],
    summary: "",
    lastModel: null,
    nextModel: "openai/gpt-6-luna",
    design: null,
    pendingDesigns: [],
  };
}
