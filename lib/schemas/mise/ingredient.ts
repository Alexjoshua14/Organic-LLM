import { z } from "zod";

import { MISE_CAPS, MiseClientId, MiseIngredientStatusSchema } from "./shared";

import { optionalStringCatch } from "@/lib/schemas/gen-ui/shared";

/**
 * A tracked ingredient for the event's shopping/pantry list. `status` is have vs. need;
 * `checked` is "picked up at the store". Links back to a recipe via `recipeId` when known.
 */
export const MiseIngredientSchema = z.object({
  id: MiseClientId,
  recipeId: MiseClientId.optional(),
  name: z.string().min(1).max(160),
  quantity: optionalStringCatch(),
  unit: optionalStringCatch(),
  category: z.string().max(MISE_CAPS.category).optional(),
  status: MiseIngredientStatusSchema.default("need"),
  checked: z.boolean().default(false),
});

export type MiseIngredient = z.infer<typeof MiseIngredientSchema>;

/** Partial ingredient; the target id lives on the command, not the patch. */
export const MiseIngredientPatchSchema = MiseIngredientSchema.partial();
export type MiseIngredientPatch = z.infer<typeof MiseIngredientPatchSchema>;
