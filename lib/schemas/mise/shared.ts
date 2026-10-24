import { z } from "zod";

/** Schema version for all mise (Remy planning) commands. Bump on breaking change. */
export const MISE_VERSION = z.literal(1);

/** Caps keep model output bounded and predictable (mirrors the kanban caps pattern). */
export const MISE_CAPS = {
  eventTitle: 160,
  location: 160,
  notes: 4_000,
  recipeTitle: 160,
  recipesPerUpsert: 20,
  ingredientsPerUpsert: 80,
  recipeIngredients: 60,
  recipeSteps: 40,
  timelineSteps: 30,
  viewTitle: 160,
  viewSummary: 600,
  category: 60,
  clientId: 120,
} as const;

/** Have-it vs. need-to-buy. Shared by the ingredient tracker and shopping-list view. */
export const MISE_INGREDIENT_STATUSES = ["have", "need"] as const;
export const MiseIngredientStatusSchema = z.enum(MISE_INGREDIENT_STATUSES);
export type MiseIngredientStatus = z.infer<typeof MiseIngredientStatusSchema>;

/** Stable, client/LLM-supplied id used as the key in the store and as `client_key` in Supabase. */
export const MiseClientId = z.string().min(1).max(MISE_CAPS.clientId);
