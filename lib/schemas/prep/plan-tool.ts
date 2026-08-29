import { z } from "zod";

import { PrepClientKey, PrepIngredientStatusSchema, PrepIsoDate, PrepSlotSchema } from "./shared";

import { RecipeCardBodySchema } from "@/lib/schemas/gen-ui/recipe-card";

/** Remy weekly meal-prep tool (write-through to prep_* tables). */
export const PREP_PLAN_TOOL_NAME = "prep_plan";

export const PREP_PLAN_COMMANDS = [
  "UPSERT_RECIPE",
  "PLACE_MEAL",
  "SET_LEFTOVER",
  "CLEAR_SLOT",
  "SET_INGREDIENT_STATUS",
  "LIST_WEEK",
  "LIST_LIBRARY",
] as const;

export const PrepPlanCommandSchema = z.enum(PREP_PLAN_COMMANDS);
export type PrepPlanCommand = z.infer<typeof PrepPlanCommandSchema>;

/** Recipe draft for UPSERT_RECIPE. `clientKey` is filled from the title when omitted. */
export const PrepPlanRecipeDraftSchema = RecipeCardBodySchema.extend({
  id: z.string().uuid().optional(),
  clientKey: PrepClientKey.optional(),
});

export type PrepPlanRecipeDraft = z.infer<typeof PrepPlanRecipeDraftSchema>;

export const PrepPlanInputSchema = z.object({
  command: PrepPlanCommandSchema.describe(
    "Which operation to perform on the durable week planner / recipe library"
  ),
  recipe: PrepPlanRecipeDraftSchema.optional().describe(
    "UPSERT_RECIPE: library card to create or replace"
  ),
  weekStart: PrepIsoDate.optional().describe(
    "Monday of the target week (YYYY-MM-DD). Any date in the week is accepted; omitted = this week."
  ),
  date: PrepIsoDate.optional().describe(
    "Slot calendar date (YYYY-MM-DD) for PLACE_MEAL / SET_LEFTOVER / CLEAR_SLOT"
  ),
  slot: PrepSlotSchema.optional().describe("breakfast | lunch | dinner"),
  recipeId: z
    .string()
    .uuid()
    .optional()
    .describe("PLACE_MEAL: library recipe UUID (from LIST_LIBRARY)"),
  clientKey: PrepClientKey.optional().describe(
    "PLACE_MEAL: library clientKey when recipeId is unknown"
  ),
  leftoverOfPlacementId: z
    .string()
    .uuid()
    .optional()
    .describe("SET_LEFTOVER: cook placement UUID this leftover copies"),
  leftoverOfDate: PrepIsoDate.optional().describe(
    "SET_LEFTOVER: date of the cook slot when leftoverOfPlacementId is unknown"
  ),
  leftoverOfSlot: PrepSlotSchema.optional().describe(
    "SET_LEFTOVER: slot of the cook placement when leftoverOfPlacementId is unknown"
  ),
  identity: z
    .string()
    .min(1)
    .max(240)
    .optional()
    .describe("SET_INGREDIENT_STATUS: shopping-row identity from LIST_WEEK"),
  status: PrepIngredientStatusSchema.optional().describe("SET_INGREDIENT_STATUS: have | need"),
  checked: z.boolean().optional().describe("SET_INGREDIENT_STATUS: picked up / crossed off"),
  search: z.string().max(140).optional().describe("LIST_LIBRARY: optional title filter"),
});

export type PrepPlanInput = z.infer<typeof PrepPlanInputSchema>;

export const PrepRecipeSummarySchema = z.object({
  id: z.string(),
  clientKey: z.string(),
  title: z.string(),
  complexity: z.string().optional(),
  duration: z.string().optional(),
  mainProtein: z.string().optional(),
  mainCarbs: z.string().optional(),
});

export type PrepRecipeSummary = z.infer<typeof PrepRecipeSummarySchema>;

export const PrepPlacementSummarySchema = z.object({
  id: z.string(),
  date: z.string(),
  slot: z.string(),
  recipeId: z.string(),
  recipeTitle: z.string().optional(),
  leftoverOfPlacementId: z.string().optional(),
});

export type PrepPlacementSummary = z.infer<typeof PrepPlacementSummarySchema>;

export const PrepIngredientSummarySchema = z.object({
  identity: z.string(),
  name: z.string(),
  quantity: z.string().optional(),
  unit: z.string().optional(),
  category: z.string().optional(),
  status: z.string(),
  checked: z.boolean(),
});

export type PrepIngredientSummary = z.infer<typeof PrepIngredientSummarySchema>;

export const PrepPlanToolOutputSchema = z.object({
  kind: z.literal("prep-plan"),
  action: z.enum(["upserted", "placed", "leftover", "cleared", "ingredient", "listed", "error"]),
  weekStart: z.string().optional(),
  weekId: z.string().optional(),
  recipes: z.array(PrepRecipeSummarySchema).optional(),
  placements: z.array(PrepPlacementSummarySchema).optional(),
  ingredients: z.array(PrepIngredientSummarySchema).optional(),
  count: z.number().int().optional(),
  error: z.string().optional(),
});

export type PrepPlanToolOutput = z.infer<typeof PrepPlanToolOutputSchema>;
