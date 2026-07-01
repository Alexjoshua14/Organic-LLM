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
