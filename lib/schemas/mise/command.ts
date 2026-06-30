import { z } from "zod";

import { MiseEventSchema } from "./event";
import { MiseIngredientSchema } from "./ingredient";
import { MiseRecipeSchema, MiseRecipePatchSchema } from "./recipe";
import { MISE_CAPS, MISE_VERSION, MiseClientId, MiseIngredientStatusSchema } from "./shared";
import { MiseViewSchema } from "./view";

import { PlanTimelineStepSchema } from "@/lib/schemas/gen-ui";

/** Create (or replace) the plan's event and optionally seed recipes/ingredients. */
export const InitiatePlanCommandSchema = z.object({
  type: z.literal("INITIATE_PLAN"),
  version: MISE_VERSION,
  event: MiseEventSchema,
  seedRecipes: z.array(MiseRecipeSchema).max(MISE_CAPS.recipesPerUpsert).optional(),
  seedIngredients: z.array(MiseIngredientSchema).max(MISE_CAPS.ingredientsPerUpsert).optional(),
});

/** Replace the event's prep-schedule timeline (reuses gen-UI plan-timeline steps). */
export const SetTimelineCommandSchema = z.object({
  type: z.literal("SET_TIMELINE"),
  version: MISE_VERSION,
  steps: z.array(PlanTimelineStepSchema).max(MISE_CAPS.timelineSteps),
});

/** Insert or update a batch of recipe cards (matched by id). */
export const UpsertRecipesCommandSchema = z.object({
  type: z.literal("UPSERT_RECIPES"),
  version: MISE_VERSION,
  recipes: z.array(MiseRecipeSchema).min(1).max(MISE_CAPS.recipesPerUpsert),
});

/** Patch a single recipe card. */
export const UpdateRecipeCommandSchema = z.object({
  type: z.literal("UPDATE_RECIPE"),
  version: MISE_VERSION,
  id: MiseClientId,
  patch: MiseRecipePatchSchema,
});

/** Remove a recipe card. */
export const RemoveRecipeCommandSchema = z.object({
  type: z.literal("REMOVE_RECIPE"),
  version: MISE_VERSION,
  id: MiseClientId,
});

/** Insert or update a batch of tracked ingredients (matched by id). */
export const UpsertIngredientsCommandSchema = z.object({
  type: z.literal("UPSERT_INGREDIENTS"),
  version: MISE_VERSION,
  ingredients: z.array(MiseIngredientSchema).min(1).max(MISE_CAPS.ingredientsPerUpsert),
});

/** Toggle an ingredient's have/need status and/or its picked-up checkbox. */
export const SetIngredientStatusCommandSchema = z
  .object({
    type: z.literal("SET_INGREDIENT_STATUS"),
    version: MISE_VERSION,
    id: MiseClientId,
    status: MiseIngredientStatusSchema.optional(),
    checked: z.boolean().optional(),
  })
  .refine((c) => c.status !== undefined || c.checked !== undefined, {
    message: "Provide at least one of `status` or `checked`",
  });

/** Remove a tracked ingredient. */
export const RemoveIngredientCommandSchema = z.object({
  type: z.literal("REMOVE_INGREDIENT"),
  version: MISE_VERSION,
  id: MiseClientId,
});

/** Present a saved view to the user (anchored in the thread). */
export const ShowViewCommandSchema = z.object({
  type: z.literal("SHOW_VIEW"),
  version: MISE_VERSION,
  view: MiseViewSchema,
});

export const MiseCommandSchema = z.discriminatedUnion("type", [
  InitiatePlanCommandSchema,
  SetTimelineCommandSchema,
  UpsertRecipesCommandSchema,
  UpdateRecipeCommandSchema,
  RemoveRecipeCommandSchema,
  UpsertIngredientsCommandSchema,
  SetIngredientStatusCommandSchema,
  RemoveIngredientCommandSchema,
  ShowViewCommandSchema,
]);

export type MiseCommand = z.infer<typeof MiseCommandSchema>;
export type InitiatePlanCommand = z.infer<typeof InitiatePlanCommandSchema>;
export type SetTimelineCommand = z.infer<typeof SetTimelineCommandSchema>;
export type UpsertRecipesCommand = z.infer<typeof UpsertRecipesCommandSchema>;
export type UpsertIngredientsCommand = z.infer<typeof UpsertIngredientsCommandSchema>;
export type SetIngredientStatusCommand = z.infer<typeof SetIngredientStatusCommandSchema>;
export type ShowViewCommand = z.infer<typeof ShowViewCommandSchema>;
