import { describe, expect, test } from "bun:test";

import {
  aggregateWeekIngredients,
  ingredientIdentity,
  parseQuantity,
} from "@/lib/prep/shopping";
import type { CookPlacementForShopping } from "@/lib/prep/shopping";

const chili: CookPlacementForShopping = {
  servings: "4",
  ingredients: [
    { name: "Ground Beef", quantity: "1", unit: "lb" },
    { name: "kidney beans", quantity: "2", unit: "cans" },
    { name: "salt", quantity: "to taste" },
  ],
};

const rice: CookPlacementForShopping = {
  servings: "2",
  ingredients: [
    { name: "rice", quantity: "1.5", unit: "cups" },
    { name: "salt", quantity: "1", unit: "tsp" },
  ],
};

const leftoverChili: CookPlacementForShopping = {
  leftoverOfPlacementId: "placement-dinner-mon",
  servings: "4",
  ingredients: chili.ingredients,
};

describe("ingredientIdentity", () => {
  test("normalizes case and whitespace; unit is part of the key", () => {
    expect(ingredientIdentity("Ground  Beef", "LB")).toBe(ingredientIdentity("ground beef", "lb"));
    expect(ingredientIdentity("salt", "tsp")).not.toBe(ingredientIdentity("salt", "tbsp"));
    expect(ingredientIdentity("salt")).toBe("salt|");
  });
});

describe("parseQuantity", () => {
  test("reads decimals, fractions, and mixed numbers", () => {
    expect(parseQuantity("1.5")).toBe(1.5);
    expect(parseQuantity("1/2")).toBe(0.5);
    expect(parseQuantity("1 1/2")).toBe(1.5);
    expect(parseQuantity("to taste")).toBeNull();
  });
});

describe("aggregateWeekIngredients", () => {
  test("ignores leftover-of placements so a cook is counted once", () => {
    const rows = aggregateWeekIngredients([chili, leftoverChili]);
    const beef = rows.find((r) => r.name === "Ground Beef");

    expect(beef?.quantity).toBe("1");
    expect(rows.filter((r) => r.identity === ingredientIdentity("Ground Beef", "lb"))).toHaveLength(1);
  });

  test("does not add leftover ingredients even when the leftover is the only placement of that recipe that day", () => {
    const rows = aggregateWeekIngredients([rice, leftoverChili]);

    expect(rows.find((r) => r.identity === ingredientIdentity("ground beef", "lb"))).toBeUndefined();
    expect(rows.find((r) => r.identity === ingredientIdentity("rice", "cups"))?.quantity).toBe("1.5");
  });

  test("merges the same normalized name+unit and sums numeric quantities", () => {
    const secondChili: CookPlacementForShopping = {
      servings: "8",
      ingredients: [{ name: "ground beef", quantity: "1", unit: "lb" }],
    };
    const rows = aggregateWeekIngredients([chili, secondChili]);
    const beef = rows.find((r) => r.identity === ingredientIdentity("ground beef", "lb"));

    expect(beef?.quantity).toBe("2");
  });

  test("does not treat the servings string as a quantity multiplier", () => {
    const bars: CookPlacementForShopping = {
      servings: "16 small squares",
      ingredients: [{ name: "flour", quantity: "1.5", unit: "cups" }],
    };
    const rows = aggregateWeekIngredients([bars]);

    expect(rows[0]?.quantity).toBe("1.5");
  });

  test("keeps have/need/checked when identity still matches after re-aggregation", () => {
    const identity = ingredientIdentity("ground beef", "lb");
    const first = aggregateWeekIngredients([chili], [
      { identity, status: "have", checked: true, category: "Meat" },
    ]);
    const beef = first.find((r) => r.identity === identity);

    expect(beef?.status).toBe("have");
    expect(beef?.checked).toBe(true);
    expect(beef?.category).toBe("Meat");

    const afterLeftoverOnly = aggregateWeekIngredients([leftoverChili], first);

    expect(afterLeftoverOnly.find((r) => r.identity === identity)).toBeUndefined();
  });

  test("new identities default to need/unchecked", () => {
    const rows = aggregateWeekIngredients([rice]);
    const riceRow = rows.find((r) => r.identity === ingredientIdentity("rice", "cups"));

    expect(riceRow?.status).toBe("need");
    expect(riceRow?.checked).toBe(false);
  });

  test("keeps non-numeric quantities and merges salt across unit-less vs unit keys separately", () => {
    const rows = aggregateWeekIngredients([chili, rice]);
    const saltTaste = rows.find((r) => r.identity === ingredientIdentity("salt"));
    const saltTsp = rows.find((r) => r.identity === ingredientIdentity("salt", "tsp"));

    expect(saltTaste?.quantity).toBe("to taste");
    expect(saltTsp?.quantity).toBe("1");
  });
});
