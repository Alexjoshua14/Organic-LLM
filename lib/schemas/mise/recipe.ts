import { z } from "zod";

import { MiseClientId } from "./shared";

import { RecipeCardBodySchema } from "@/lib/schemas/gen-ui/recipe-card";

/**
 * A recipe card grouped under an event. Same body as the gen-UI `recipe-card`
 * so a single type flows from import → store → persisted view.
 */
export const MiseRecipeSchema = RecipeCardBodySchema.extend({
  id: MiseClientId,
});

export type MiseRecipe = z.infer<typeof MiseRecipeSchema>;

/** Partial recipe for UPDATE_RECIPE; the target id lives on the command, not the patch. */
export const MiseRecipePatchSchema = MiseRecipeSchema.partial();
export type MiseRecipePatch = z.infer<typeof MiseRecipePatchSchema>;
