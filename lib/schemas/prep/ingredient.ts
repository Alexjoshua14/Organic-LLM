import { z } from "zod";

import { PREP_CAPS, PrepIngredientStatusSchema } from "./shared";

import { optionalStringCatch } from "@/lib/schemas/gen-ui/shared";

/**
 * Aggregated shopping row for a week. `identity` is the merge key
 * (normalized name+unit) and the stable id for have/need/checked.
 */
export const PrepWeekIngredientSchema = z.object({
  identity: z.string().min(1).max(PREP_CAPS.identity),
  name: z.string().min(1).max(160),
  quantity: optionalStringCatch(),
  unit: optionalStringCatch(),
  category: z.string().max(PREP_CAPS.category).optional(),
  status: PrepIngredientStatusSchema.default("need"),
  checked: z.boolean().default(false),
});

export type PrepWeekIngredient = z.infer<typeof PrepWeekIngredientSchema>;

export const PrepWeekIngredientStatusPatchSchema = z
  .object({
    status: PrepIngredientStatusSchema.optional(),
    checked: z.boolean().optional(),
  })
  .refine((p) => p.status !== undefined || p.checked !== undefined, {
    message: "status or checked is required",
  });

export type PrepWeekIngredientStatusPatch = z.infer<typeof PrepWeekIngredientStatusPatchSchema>;
