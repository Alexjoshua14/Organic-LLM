import { z } from "zod";

import { PrepClientKey } from "./shared";

import { RecipeCardBodySchema } from "@/lib/schemas/gen-ui/recipe-card";

/**
 * Library recipe: same body as the gen-UI `recipe-card` / `MiseRecipe`.
 * `id` is the persisted UUID; `clientKey` is the LLM/store upsert key.
 */
export const PrepRecipeSchema = RecipeCardBodySchema.extend({
  id: z.string().uuid(),
  clientKey: PrepClientKey,
});

export type PrepRecipe = z.infer<typeof PrepRecipeSchema>;

/** Upsert payload: client key + body; server UUID optional until insert. */
export const PrepRecipeUpsertSchema = RecipeCardBodySchema.extend({
  id: z.string().uuid().optional(),
  clientKey: PrepClientKey,
});

export type PrepRecipeUpsert = z.infer<typeof PrepRecipeUpsertSchema>;

export const PrepRecipePatchSchema = RecipeCardBodySchema.partial().extend({
  clientKey: PrepClientKey.optional(),
});

export type PrepRecipePatch = z.infer<typeof PrepRecipePatchSchema>;
