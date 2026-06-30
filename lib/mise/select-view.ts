import type { PlanTimelineBlock, RecipeCardBlock, ShoppingListBlock } from "@/lib/schemas/gen-ui";
import type { MiseIngredient, MiseRecipe, MiseView } from "@/lib/schemas/mise";
import type { MisePlanState } from "@/lib/mise/types";

/** Recipes in insertion order, optionally narrowed to one by the view filter. */
export function selectRecipes(plan: MisePlanState, view?: MiseView): MiseRecipe[] {
  const ordered = plan.recipeOrder
    .map((id) => plan.recipes[id])
    .filter((r): r is MiseRecipe => Boolean(r));

  const recipeId = view?.filter?.recipeId;

  return recipeId ? ordered.filter((r) => r.id === recipeId) : ordered;
}

/**
 * Ingredients in insertion order, filtered by the view's intent (shopping-list → need,
 * pantry → have) and any explicit status/category filter.
 */
export function selectIngredients(plan: MisePlanState, view?: MiseView): MiseIngredient[] {
  let status = view?.filter?.status;

  if (!status && view?.intent === "shopping-list") status = "need";
  if (!status && view?.intent === "pantry") status = "have";

  const category = view?.filter?.category;

  return plan.ingredientOrder
    .map((id) => plan.ingredients[id])
    .filter((i): i is MiseIngredient => Boolean(i))
    .filter((i) => (status ? i.status === status : true))
    .filter((i) => (category ? i.category === category : true));
}

export function recipeToBlock(recipe: MiseRecipe): RecipeCardBlock {
  return {
    type: "recipe-card",
    version: 1,
    title: recipe.title,
    sourceUrl: recipe.sourceUrl,
    servings: recipe.servings,
    prepTime: recipe.prepTime,
    cookTime: recipe.cookTime,
    ingredients: recipe.ingredients,
    steps: recipe.steps,
    notes: recipe.notes,
  };
}

export function timelineToBlock(plan: MisePlanState): PlanTimelineBlock {
  return {
    type: "plan-timeline",
    version: 1,
    title: plan.event.title,
    steps: plan.timeline,
  };
}

const UNCATEGORIZED = "Other";

/**
 * Build a `shopping-list` block grouped by category, plus a parallel `ids` grid so an
 * interactive view can map a clicked {groupIndex, itemIndex} back to the ingredient's id.
 */
export function buildShoppingList(
  plan: MisePlanState,
  view?: MiseView
): { block: ShoppingListBlock; ids: string[][] } {
  const items = selectIngredients(plan, view);
  const byCategory = new Map<string, MiseIngredient[]>();

  for (const item of items) {
    const cat = item.category?.trim() || UNCATEGORIZED;

    if (!byCategory.has(cat)) byCategory.set(cat, []);
    byCategory.get(cat)!.push(item);
  }

  const recipeTitle = (recipeId?: string): string | undefined =>
    recipeId ? plan.recipes[recipeId]?.title : undefined;

  const groups = [...byCategory.entries()].map(([category, catItems]) => ({
    category,
    items: catItems.map((i) => ({
      name: i.name,
      quantity: i.quantity,
      unit: i.unit,
      status: i.status,
      checked: i.checked,
      recipe: recipeTitle(i.recipeId),
    })),
  }));

  const ids = [...byCategory.values()].map((catItems) => catItems.map((i) => i.id));

  // The runtime schema requires ≥1 group; callers check hasShoppingItems before rendering, so
  // an empty `groups` here is only ever used by the empty-state branch in the UI.
  const block: ShoppingListBlock = {
    type: "shopping-list",
    version: 1,
    title: view?.title ?? `${plan.event.title} — shopping list`,
    groups,
  };

  return { block, ids };
}

export function hasShoppingItems(plan: MisePlanState, view?: MiseView): boolean {
  return selectIngredients(plan, view).length > 0;
}
