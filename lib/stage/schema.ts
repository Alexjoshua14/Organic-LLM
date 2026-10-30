import { z } from "zod";

import { ChatEffortLevelSchema } from "@/lib/schemas/chat-effort";
import { RecipeCardBlockSchema } from "@/lib/schemas/gen-ui/recipe-card";

export const STAGE_SIZE = 32;
export const STAGE_AGENT_RECT = { x: 13, y: 11, w: 6, h: 8 } as const;
export const STAGE_MAX_WIDGETS = 48;
export const STAGE_MAX_PENDING_DESIGNS = 8;

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
  })
  .strict();

export const StageDesignSchema = z
  .object({
    id: z.string().uuid(),
    status: z.enum(["working", "failed"]),
    startedAt: z.string().datetime(),
    brief: z.string().max(2000),
    error: z.string().max(200).optional(),
  })
  .strict();

export const StageStateSchema = z
  .object({
    revision: z.number().int().nonnegative(),
    updatedAt: z.string().datetime(),
    widgets: z.array(StageWidgetSchema).max(STAGE_MAX_WIDGETS),
    messages: z.array(StageMessageSchema).max(24),
    summary: z.string().max(6000),
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
      "layout",
      "design-start",
      "design-complete",
      "design-failed",
      "turn-failed",
    ]),
    requestId: z.string().uuid().nullable(),
    lastModel: z.string().nullable(),
    nextModel: z.string(),
    usage: z
      .object({ inputTokens: z.number().nonnegative(), outputTokens: z.number().nonnegative() })
      .nullable(),
    call: z
      .object({
        operation: z.enum(["turn", "design"]),
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
