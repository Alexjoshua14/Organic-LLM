import { z } from "zod";

import { StageRectSchema } from "./schema";
import { StageViewSchema } from "./view-schema";

const DESIGN_UPSERT = z.object({
  operation: z.literal("upsert"),
  kind: z.enum(["note", "mermaid", "recipe", "chat"]),
  title: z.string().min(1).max(100),
  targetId: z.string().uuid().nullable(),
  rect: StageRectSchema.nullable(),
  view: StageViewSchema.nullable().optional(),
  text: z.string().max(4000).nullable(),
  code: z.string().max(8000).nullable(),
  ingredients: z.array(z.string().max(200)).max(40).nullable(),
  steps: z.array(z.string().max(1000)).max(30).nullable(),
});

export const DESIGN_PLAN = z.object({
  operations: z
    .array(
      z.union([
        DESIGN_UPSERT,
        z.object({
          operation: z.literal("move"),
          targetId: z.string().uuid(),
          rect: StageRectSchema,
          view: StageViewSchema.nullable().optional(),
        }),
        z.object({ operation: z.literal("remove"), targetId: z.string().uuid() }),
      ])
    )
    .max(8),
});
export type DesignPlan = z.infer<typeof DESIGN_PLAN>;
