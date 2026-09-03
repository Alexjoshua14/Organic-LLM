import { describe, expect, test } from "bun:test";

import { HOUSEWARMING_RECIPES } from "@/lib/schemas/mise/fixtures";
import {
  PrepPlacementSchema,
  PrepRecipeSchema,
  PrepRecipeUpsertSchema,
  PrepWeekIngredientSchema,
  PrepWeekSchema,
} from "@/lib/schemas/prep";

const RECIPE_ID = "11111111-1111-4111-8111-111111111111";
const WEEK_ID = "22222222-2222-4222-8222-222222222222";

const upsertBody = {
  clientKey: "chili",
  title: "Weeknight chili",
  servings: "4",
  complexity: "easy" as const,
  duration: "45 min",
  mainProtein: "beef",
  mainCarbs: "beans",
  cuisine: "Tex-Mex",
  equipment: ["dutch oven"],
  ingredients: [
    { name: "ground beef", quantity: "1", unit: "lb" },
    { name: "kidney beans", quantity: "2", unit: "cans" },
  ],
  steps: ["Brown the beef.", "Simmer with beans."],
};

describe("PrepRecipeSchema", () => {
  test("parses a library row with the shared recipe-card glance fields", () => {
    const parsed = PrepRecipeSchema.safeParse({ id: RECIPE_ID, ...upsertBody });

    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.complexity).toBe("easy");
      expect(parsed.data.mainProtein).toBe("beef");
    }
  });

  test("parses existing card bodies that omit glance fields", () => {
    const { id: _miseId, ...body } = HOUSEWARMING_RECIPES[0];
    const parsed = PrepRecipeUpsertSchema.safeParse({
      clientKey: "bars",
      ...body,
    });

    expect(parsed.success).toBe(true);
  });

  test("rejects a recipe with no steps", () => {
    const parsed = PrepRecipeUpsertSchema.safeParse({
      clientKey: "bad",
      title: "Bad",
      ingredients: [{ name: "flour" }],
      steps: [],
    });

    expect(parsed.success).toBe(false);
  });
});

describe("PrepWeekSchema / PrepPlacementSchema", () => {
  test("accepts a Monday week_start", () => {
    expect(PrepWeekSchema.safeParse({ id: WEEK_ID, weekStart: "2026-08-10" }).success).toBe(true);
  });

  test("leftover pointer is optional on a cook placement", () => {
    const cook = PrepPlacementSchema.safeParse({
      id: RECIPE_ID,
      weekId: WEEK_ID,
      date: "2026-08-10",
      slot: "dinner",
      recipeId: RECIPE_ID,
    });

    expect(cook.success).toBe(true);
    if (cook.success) expect(cook.data.leftoverOfPlacementId).toBeUndefined();
  });

  test("rejects an unknown slot", () => {
    expect(
      PrepPlacementSchema.safeParse({
        id: RECIPE_ID,
        weekId: WEEK_ID,
        date: "2026-08-10",
        slot: "snack",
        recipeId: RECIPE_ID,
      }).success
    ).toBe(false);
  });
});

describe("PrepWeekIngredientSchema", () => {
  test("defaults status to need and checked to false", () => {
    const parsed = PrepWeekIngredientSchema.parse({
      identity: "flour|cups",
      name: "flour",
      quantity: "3",
      unit: "cups",
    });

    expect(parsed.status).toBe("need");
    expect(parsed.checked).toBe(false);
  });
});
