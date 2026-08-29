import { describe, expect, test } from "bun:test";

import { parseRemyMode, remyDashboardHref, remyDashboardQuery } from "@/lib/prep/dashboard";
import { prepRecipeToBlock } from "@/lib/prep/recipe-block";
import { buildPrepShoppingList } from "@/lib/prep/shopping-view";
import type { PrepRecipe } from "@/lib/schemas/prep";

const recipe: PrepRecipe = {
  id: "11111111-1111-4111-8111-111111111111",
  clientKey: "chili",
  title: "Chili",
  servings: "4",
  complexity: "easy",
  duration: "40 min",
  mainProtein: "beef",
  mainCarbs: "beans",
  ingredients: [{ name: "beef", quantity: "1", unit: "lb" }],
  steps: ["Brown the beef"],
};

describe("parseRemyMode / remyDashboardQuery", () => {
  test("defaults to week and omits mode from the query", () => {
    expect(parseRemyMode(null)).toBe("week");
    expect(parseRemyMode("library")).toBe("library");
    expect(parseRemyMode("nope")).toBe("week");
    expect(remyDashboardQuery("2026-08-10", "week")).toBe("week=2026-08-10");
    expect(remyDashboardHref("2026-08-10", "shopping")).toBe(
      "/remy?week=2026-08-10&mode=shopping"
    );
  });
});

describe("prepRecipeToBlock", () => {
  test("drops id/clientKey and keeps glance fields on the shared card body", () => {
    const block = prepRecipeToBlock(recipe);

    expect(block.type).toBe("recipe-card");
    expect(block.version).toBe(1);
    expect(block.title).toBe("Chili");
    expect(block.complexity).toBe("easy");
    expect(block.mainProtein).toBe("beef");
    expect(block).not.toHaveProperty("id");
    expect(block).not.toHaveProperty("clientKey");
  });
});

describe("buildPrepShoppingList", () => {
  test("groups by category and returns a parallel identity grid", () => {
    const { block, identities } = buildPrepShoppingList(
      [
        {
          identity: "beef|lb",
          name: "beef",
          quantity: "1",
          unit: "lb",
          category: "Meat",
          status: "need",
          checked: false,
        },
        {
          identity: "salt|",
          name: "salt",
          status: "have",
          checked: true,
        },
      ],
      "Shopping · Aug 10–16, 2026"
    );

    expect(block.groups.map((g) => g.category)).toEqual(["Meat", "Other"]);
    expect(identities).toEqual([["beef|lb"], ["salt|"]]);
    expect(block.groups[1]?.items[0]?.status).toBe("have");
  });
});
