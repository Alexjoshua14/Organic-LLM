import { z } from "zod";

import { MISE_CAPS, MiseClientId } from "./shared";

import { RecipeIngredientSchema } from "@/lib/schemas/gen-ui";
import { httpUrl, optionalStringCatch } from "@/lib/schemas/gen-ui/shared";

/**
 * A recipe card grouped under an event. Field shapes mirror the gen-UI `recipe-card`
 * block so a single type flows from import → store → persisted view.
 */
export const MiseRecipeSchema = z.object({
  id: MiseClientId,
  title: z.string().min(1).max(MISE_CAPS.recipeTitle),
  sourceUrl: httpUrl().optional().catch(undefined),
  servings: optionalStringCatch(),
  prepTime: optionalStringCatch(),
  cookTime: optionalStringCatch(),
  ingredients: z.array(RecipeIngredientSchema).min(1).max(MISE_CAPS.recipeIngredients),
  steps: z.array(z.string().min(1)).min(1).max(MISE_CAPS.recipeSteps),
  notes: optionalStringCatch(),
});

export type MiseRecipe = z.infer<typeof MiseRecipeSchema>;

/** Partial recipe for UPDATE_RECIPE; the target id lives on the command, not the patch. */
export const MiseRecipePatchSchema = MiseRecipeSchema.partial();
export type MiseRecipePatch = z.infer<typeof MiseRecipePatchSchema>;
