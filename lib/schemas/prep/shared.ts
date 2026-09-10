import { z } from "zod";

/** Caps keep model/library input bounded (mirrors mise). */
export const PREP_CAPS = {
  clientId: 120,
  category: 60,
  recipesPerUpsert: 40,
  identity: 240,
} as const;

export const PREP_SLOTS = ["breakfast", "lunch", "dinner"] as const;
export const PrepSlotSchema = z.enum(PREP_SLOTS);
export type PrepSlot = z.infer<typeof PrepSlotSchema>;

export const PREP_INGREDIENT_STATUSES = ["have", "need"] as const;
export const PrepIngredientStatusSchema = z.enum(PREP_INGREDIENT_STATUSES);
export type PrepIngredientStatus = z.infer<typeof PrepIngredientStatusSchema>;

/** Stable LLM/store id stored as `client_key` on prep_recipes. */
export const PrepClientKey = z.string().min(1).max(PREP_CAPS.clientId);

/** ISO calendar date (YYYY-MM-DD). */
export const PrepIsoDate = z.iso.date();
