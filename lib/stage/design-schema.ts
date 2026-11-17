import { z } from "zod";

import { StageRectSchema } from "./schema";
import { StageViewSchema } from "./view-schema";

// Strict structured output (OpenAI) rejects the whole schema if any property is optional, before
// the model runs. Every field is required and nullable instead; null means "not given".
// tests/unit/stage-model-schemas.test.ts guards this for every Stage model schema.
const DESIGN_UPSERT = z.object({
  operation: z.literal("upsert"),
  kind: z.enum(["note", "mermaid", "recipe", "block", "web", "chat"]),
  title: z.string().min(1).max(100),
  targetId: z.string().uuid().nullable(),
  rect: StageRectSchema.nullable(),
  view: StageViewSchema.nullable(),
  text: z.string().max(4000).nullable(),
  code: z.string().max(8000).nullable(),
  // JSON of one gen-ui block (research-report, answer-card, decision-matrix, plan-timeline, shopping-list, restaurant-card, code-diff…); kind "block" only.
  block: z.string().max(12000).nullable(),
  // Public https page to frame in the grid; kind "web" only.
  url: z.string().max(2000).nullable(),
  ingredients: z.array(z.string().max(200)).max(40).nullable(),
  steps: z.array(z.string().max(1000)).max(30).nullable(),
});

export const DESIGN_PLAN = z.object({
  // The brief moves to a new topic: every piece the plan does not update or move is cleared in
  // one step (collections and recall stay), so operations go to the new pieces, not removals.
  fresh: z.boolean(),
  operations: z
    .array(
      z.union([
        DESIGN_UPSERT,
        z.object({
          operation: z.literal("move"),
          targetId: z.string().uuid(),
          rect: StageRectSchema,
          view: StageViewSchema.nullable(),
        }),
        z.object({ operation: z.literal("remove"), targetId: z.string().uuid() }),
      ])
    )
    .max(8),
});
export type DesignPlan = z.infer<typeof DESIGN_PLAN>;
