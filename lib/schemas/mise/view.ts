import { z } from "zod";

import { MISE_CAPS, MiseClientId, MiseIngredientStatusSchema } from "./shared";

export const MISE_VIEW_INTENTS = [
  "overview",
  "menu",
  "timeline",
  "recipe",
  "shopping-list",
  "pantry",
] as const;

export const MiseViewIntentSchema = z.enum(MISE_VIEW_INTENTS);
export type MiseViewIntent = z.infer<typeof MiseViewIntentSchema>;

/** Declarative filter the client applies against the current plan state. */
export const MiseViewFilterSchema = z.object({
  /** Limit a `recipe` view to one recipe by its client id. */
  recipeId: MiseClientId.optional(),
  /** Limit shopping/pantry views to one category. */
  category: z.string().max(MISE_CAPS.category).optional(),
  /** Limit to have/need. */
  status: MiseIngredientStatusSchema.optional(),
});

export type MiseViewFilter = z.infer<typeof MiseViewFilterSchema>;

/**
 * A saved view the model summons. Like the kanban view, it is a *recipe* (intent + filter),
 * not a data snapshot — the client renders it against the current plan.
 */
export const MiseViewSchema = z.object({
  id: MiseClientId,
  title: z.string().min(1).max(MISE_CAPS.viewTitle),
  intent: MiseViewIntentSchema,
  summary: z.string().max(MISE_CAPS.viewSummary).optional(),
  filter: MiseViewFilterSchema.optional(),
});

export type MiseView = z.infer<typeof MiseViewSchema>;
