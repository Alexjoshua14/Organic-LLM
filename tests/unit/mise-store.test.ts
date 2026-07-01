import { describe, expect, test } from "bun:test";

import { reduceMisePlan } from "@/lib/mise/store";
import { buildShoppingList, selectIngredients, selectRecipes } from "@/lib/mise/select-view";
import type { MisePlanState } from "@/lib/mise/types";
import { HOUSEWARMING_INITIATE } from "@/lib/schemas/mise/fixtures";

function hydrated(): MisePlanState {
  return reduceMisePlan(undefined, HOUSEWARMING_INITIATE);
}

describe("reduceMisePlan", () => {
  test("INITIATE_PLAN seeds the event, recipes, ingredients, and timeline", () => {
    const plan = hydrated();

    expect(plan.status).toBe("ready");
    expect(plan.event.title).toBe("Housewarming");
    expect(plan.event.guestCount).toBe(15);
    expect(plan.recipeOrder).toEqual(["bars", "pita"]);
    expect(plan.timeline.length).toBe(3);
    expect(Object.keys(plan.ingredients).length).toBe(3);
  });

  test("SET_TIMELINE replaces the schedule", () => {
    const plan = reduceMisePlan(hydrated(), {
      type: "SET_TIMELINE",
      version: 1,
      steps: [{ id: "s1", label: "Shop", status: "now" }],
    });

    expect(plan.timeline.length).toBe(1);
    expect(plan.timeline[0].label).toBe("Shop");
  });

  test("UPSERT_RECIPES adds a new card and updates an existing one", () => {
    const added = reduceMisePlan(hydrated(), {
      type: "UPSERT_RECIPES",
      version: 1,
      recipes: [
        { id: "hummus", title: "Hummus", ingredients: [{ name: "chickpeas" }], steps: ["Blend"] },
      ],
    });

    expect(added.recipeOrder).toContain("hummus");

    const updated = reduceMisePlan(added, {
      type: "UPDATE_RECIPE",
      version: 1,
      id: "hummus",
      patch: { servings: "8" },
    });

    expect(updated.recipes.hummus.servings).toBe("8");
    expect(updated.recipes.hummus.title).toBe("Hummus");
  });

  test("SET_INGREDIENT_STATUS flips status and checked", () => {
    const plan = reduceMisePlan(hydrated(), {
      type: "SET_INGREDIENT_STATUS",
      version: 1,
      id: "ing-lemons",
      status: "have",
      checked: true,
    });

    expect(plan.ingredients["ing-lemons"].status).toBe("have");
    expect(plan.ingredients["ing-lemons"].checked).toBe(true);
  });

  test("REMOVE_INGREDIENT drops it from state and order", () => {
    const plan = reduceMisePlan(hydrated(), {
      type: "REMOVE_INGREDIENT",
      version: 1,
      id: "ing-flour",
    });

    expect(plan.ingredients["ing-flour"]).toBeUndefined();
    expect(plan.ingredientOrder).not.toContain("ing-flour");
  });

  test("SHOW_VIEW records the active view id without mutating data", () => {
    const plan = reduceMisePlan(hydrated(), {
      type: "SHOW_VIEW",
      version: 1,
      view: { id: "v1", title: "Menu", intent: "menu" },
    });

    expect(plan.activeViewId).toBe("v1");
    expect(plan.recipeOrder.length).toBe(2);
  });
});

describe("select-view", () => {
  test("shopping-list view shows only needed items, grouped by category", () => {
    const plan = hydrated();
    const view = { id: "v", title: "Shopping", intent: "shopping-list" as const };
    const need = selectIngredients(plan, view);

    expect(need.every((i) => i.status === "need")).toBe(true);
    expect(need.length).toBe(2); // blueberries + lemons

    const { block, ids } = buildShoppingList(plan, view);

    expect(block.groups.length).toBeGreaterThan(0);
    // ids grid aligns with the block groups for click → id mapping.
    expect(ids.length).toBe(block.groups.length);
    expect(ids[0].length).toBe(block.groups[0].items.length);
  });

  test("pantry view shows only on-hand items", () => {
    const plan = hydrated();
    const view = { id: "v", title: "Pantry", intent: "pantry" as const };
    const have = selectIngredients(plan, view);

    expect(have.every((i) => i.status === "have")).toBe(true);
    expect(have.map((i) => i.id)).toEqual(["ing-flour"]);
  });

  test("recipe view filters to one recipe by id", () => {
    const plan = hydrated();
    const view = {
      id: "v",
      title: "Pita",
      intent: "recipe" as const,
      filter: { recipeId: "pita" },
    };

    expect(selectRecipes(plan, view).map((r) => r.id)).toEqual(["pita"]);
  });
});
