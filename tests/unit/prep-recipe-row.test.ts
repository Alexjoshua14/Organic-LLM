import { describe, expect, test } from "bun:test";

import { recipeCardBodyFromRow, recipeCardBodyToRow } from "@/lib/prep/recipe-row";

describe("recipeCardBody row mapping", () => {
  test("round-trips glance fields through snake_case columns", () => {
    const body = recipeCardBodyFromRow(
      recipeCardBodyToRow({
        title: "Chili",
        servings: "4",
        complexity: "medium",
        duration: "1h",
        mainProtein: "beef",
        mainCarbs: "beans",
        cuisine: "Tex-Mex",
        equipment: ["dutch oven"],
        ingredients: [{ name: "beef", quantity: "1", unit: "lb" }],
        steps: ["Simmer."],
      })
    );

    expect(body.complexity).toBe("medium");
    expect(body.mainProtein).toBe("beef");
    expect(body.equipment).toEqual(["dutch oven"]);
  });
});
