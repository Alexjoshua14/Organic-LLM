import { describe, expect, test } from "bun:test";

import {
  GenUIBlockSchema,
  genUIBlockToMarkdown,
  recipeCardToMarkdown,
  safeParseGenUIBlock,
  shoppingListToMarkdown,
  type RecipeCardBlock,
  type ShoppingListBlock,
} from "@/lib/schemas/gen-ui";

const RECIPE: RecipeCardBlock = {
  type: "recipe-card",
  version: 1,
  title: "Hummus",
  servings: "8",
  ingredients: [{ name: "chickpeas", quantity: "1", unit: "can" }, { name: "tahini" }],
  steps: ["Blend everything.", "Drizzle with olive oil."],
  sourceUrl: "https://example.com/hummus",
};

const SHOPPING: ShoppingListBlock = {
  type: "shopping-list",
  version: 1,
  title: "Housewarming — shopping list",
  groups: [
    {
      category: "Produce",
      items: [
        { name: "lemons", quantity: "3", status: "need" },
        { name: "blueberries", status: "have", checked: true },
      ],
    },
  ],
};

describe("recipe-card block", () => {
  test("parses through the gen-UI discriminated union", () => {
    expect(GenUIBlockSchema.safeParse(RECIPE).success).toBe(true);
  });

  test("renders markdown with ingredients, steps, and source", () => {
    const md = recipeCardToMarkdown(RECIPE);

    expect(md).toContain("## Hummus");
    expect(md).toContain("1 can chickpeas");
    expect(md).toContain("1. Blend everything.");
    expect(md).toContain("https://example.com/hummus");
    expect(genUIBlockToMarkdown(RECIPE)).toBe(md);
  });

  test("rejects a recipe with no ingredients", () => {
    const bad = { ...RECIPE, ingredients: [] };

    expect(safeParseGenUIBlock(bad).ok).toBe(false);
  });

  test("accepts optional glance fields without requiring them", () => {
    const extended: RecipeCardBlock = {
      ...RECIPE,
      complexity: "easy",
      duration: "25 min",
      mainProtein: "chickpeas",
      mainCarbs: "pita",
      cuisine: "Levantine",
      equipment: ["food processor"],
    };

    expect(GenUIBlockSchema.safeParse(extended).success).toBe(true);

    const md = recipeCardToMarkdown(extended);

    expect(md).toContain("Easy");
    expect(md).toContain("Total 25 min");
    expect(md).toContain("Protein chickpeas");
    expect(md).toContain("Carbs pita");
    expect(md).toContain("Levantine");
    expect(md).toContain("food processor");
  });

  test("drops an invalid complexity instead of rejecting the card", () => {
    const parsed = GenUIBlockSchema.safeParse({ ...RECIPE, complexity: "expert" });

    expect(parsed.success).toBe(true);
    if (parsed.success && parsed.data.type === "recipe-card") {
      expect(parsed.data.complexity).toBeUndefined();
    }
  });
});

describe("shopping-list block", () => {
  test("parses and renders grouped markdown with checkbox + status", () => {
    expect(GenUIBlockSchema.safeParse(SHOPPING).success).toBe(true);

    const md = shoppingListToMarkdown(SHOPPING);

    expect(md).toContain("### Produce");
    expect(md).toContain("- [ ] 3 lemons");
    expect(md).toContain("- [x] blueberries _(have)_");
  });
});
