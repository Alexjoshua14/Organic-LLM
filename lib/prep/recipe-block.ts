import type { RecipeCardBlock } from "@/lib/schemas/gen-ui";
import type { PrepRecipe } from "@/lib/schemas/prep";

import { RecipeCardBodySchema } from "@/lib/schemas/gen-ui/recipe-card";

/** Shared RecipeCard block from a library row (drops id / clientKey). */
export function prepRecipeToBlock(recipe: PrepRecipe): RecipeCardBlock {
  return { type: "recipe-card", version: 1, ...RecipeCardBodySchema.parse(recipe) };
}
