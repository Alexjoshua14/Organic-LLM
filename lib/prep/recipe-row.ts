import type { RecipeCardBody, RecipeIngredient } from "@/lib/schemas/gen-ui/recipe-card";

import { RecipeCardBodySchema } from "@/lib/schemas/gen-ui/recipe-card";

/** Snake_case columns shared by `mise_recipes` and `prep_recipes`. */
export type RecipeCardBodyRow = {
  title: string;
  source_url: string | null;
  servings: string | null;
  prep_time: string | null;
  cook_time: string | null;
  duration: string | null;
  complexity: RecipeCardBody["complexity"] | null;
  main_protein: string | null;
  main_carbs: string | null;
  cuisine: string | null;
  equipment: string[] | null;
  ingredients: RecipeIngredient[];
  steps: string[];
  notes: string | null;
};

export function recipeCardBodyToRow(body: RecipeCardBody): RecipeCardBodyRow {
  return {
    title: body.title,
    source_url: body.sourceUrl ?? null,
    servings: body.servings ?? null,
    prep_time: body.prepTime ?? null,
    cook_time: body.cookTime ?? null,
    duration: body.duration ?? null,
    complexity: body.complexity ?? null,
    main_protein: body.mainProtein ?? null,
    main_carbs: body.mainCarbs ?? null,
    cuisine: body.cuisine ?? null,
    equipment: body.equipment ?? null,
    ingredients: body.ingredients,
    steps: body.steps,
    notes: body.notes ?? null,
  };
}

export function recipeCardBodyFromRow(row: Record<string, unknown>): RecipeCardBody {
  return RecipeCardBodySchema.parse({
    title: String(row.title),
    sourceUrl: (row.source_url as string | null) ?? undefined,
    servings: (row.servings as string | null) ?? undefined,
    prepTime: (row.prep_time as string | null) ?? undefined,
    cookTime: (row.cook_time as string | null) ?? undefined,
    duration: (row.duration as string | null) ?? undefined,
    complexity: (row.complexity as RecipeCardBody["complexity"] | null) ?? undefined,
    mainProtein: (row.main_protein as string | null) ?? undefined,
    mainCarbs: (row.main_carbs as string | null) ?? undefined,
    cuisine: (row.cuisine as string | null) ?? undefined,
    equipment: (row.equipment as string[] | null) ?? undefined,
    ingredients: (row.ingredients as RecipeIngredient[]) ?? [],
    steps: (row.steps as string[] | null) ?? [],
    notes: (row.notes as string | null) ?? undefined,
  });
}

export function recipeCardBodyPatchToRow(patch: Partial<RecipeCardBody>): Record<string, unknown> {
  const update: Record<string, unknown> = {};

  if (patch.title !== undefined) update.title = patch.title;
  if (patch.sourceUrl !== undefined) update.source_url = patch.sourceUrl;
  if (patch.servings !== undefined) update.servings = patch.servings;
  if (patch.prepTime !== undefined) update.prep_time = patch.prepTime;
  if (patch.cookTime !== undefined) update.cook_time = patch.cookTime;
  if (patch.duration !== undefined) update.duration = patch.duration;
  if (patch.complexity !== undefined) update.complexity = patch.complexity;
  if (patch.mainProtein !== undefined) update.main_protein = patch.mainProtein;
  if (patch.mainCarbs !== undefined) update.main_carbs = patch.mainCarbs;
  if (patch.cuisine !== undefined) update.cuisine = patch.cuisine;
  if (patch.equipment !== undefined) update.equipment = patch.equipment;
  if (patch.ingredients !== undefined) update.ingredients = patch.ingredients;
  if (patch.steps !== undefined) update.steps = patch.steps;
  if (patch.notes !== undefined) update.notes = patch.notes;

  return update;
}
