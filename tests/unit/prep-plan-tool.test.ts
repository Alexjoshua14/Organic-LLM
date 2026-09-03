import { describe, expect, test } from "bun:test";

import { executePrepPlan, type PrepPlanDeps } from "@/lib/llm/prep-plan-execute";
import type {
  PrepPlacement,
  PrepRecipe,
  PrepWeek,
  PrepWeekIngredient,
} from "@/lib/schemas/prep";
import { PrepPlanInputSchema } from "@/lib/schemas/prep";

const RECIPE_ID = "11111111-1111-4111-8111-111111111111";
const RECIPE_ID_B = "11111111-1111-4111-8111-111111111112";
const WEEK_ID = "22222222-2222-4222-8222-222222222222";
const PLACE_ID = "33333333-3333-4333-8333-333333333333";
const PLACE_ID_B = "33333333-3333-4333-8333-333333333334";

function makeRecipe(partial: Partial<PrepRecipe> & Pick<PrepRecipe, "id" | "title">): PrepRecipe {
  return {
    clientKey: partial.clientKey ?? "chili",
    title: partial.title,
    servings: partial.servings ?? "4",
    ingredients: partial.ingredients ?? [
      { name: "ground beef", quantity: "1", unit: "lb" },
      { name: "kidney beans", quantity: "2", unit: "cans" },
    ],
    steps: partial.steps ?? ["Brown the beef.", "Simmer."],
    id: partial.id,
    complexity: partial.complexity,
    duration: partial.duration,
    mainProtein: partial.mainProtein,
    mainCarbs: partial.mainCarbs,
  };
}

function makeWeek(weekStart = "2026-08-10"): PrepWeek {
  return { id: WEEK_ID, weekStart };
}

function makePlacement(partial: Partial<PrepPlacement> & Pick<PrepPlacement, "id">): PrepPlacement {
  return {
    id: partial.id,
    weekId: partial.weekId ?? WEEK_ID,
    date: partial.date ?? "2026-08-10",
    slot: partial.slot ?? "dinner",
    recipeId: partial.recipeId ?? RECIPE_ID,
    leftoverOfPlacementId: partial.leftoverOfPlacementId,
  };
}

function makeDeps(seed: {
  recipes?: PrepRecipe[];
  week?: PrepWeek | null;
  placements?: PrepPlacement[];
  ingredients?: PrepWeekIngredient[];
} = {}) {
  const recipes = new Map((seed.recipes ?? []).map((r) => [r.id, r]));
  let week = seed.week ?? null;
  const placements = [...(seed.placements ?? [])];
  const ingredients = [...(seed.ingredients ?? [])];
  let placeCounter = 0;

  const deps: PrepPlanDeps = {
    upsertRecipe: async (input) => {
      const existing = [...recipes.values()].find((r) => r.clientKey === input.clientKey);
      const id = input.id ?? existing?.id ?? RECIPE_ID;
      const row = makeRecipe({ ...input, id, title: input.title, clientKey: input.clientKey });

      recipes.set(id, row);

      return row;
    },
    listRecipes: async () => [...recipes.values()],
    getRecipe: async (id) => recipes.get(id) ?? null,
    ensureWeek: async (weekStart) => {
      week = makeWeek(weekStart);

      return week;
    },
    getWeekBundle: async (weekStart) => {
      if (!week || week.weekStart !== weekStart) return null;

      const recipeMap: Record<string, PrepRecipe> = {};

      for (const p of placements) {
        const recipe = recipes.get(p.recipeId);

        if (recipe) recipeMap[recipe.id] = recipe;
      }

      return { week, placements: [...placements], recipes: recipeMap, ingredients: [...ingredients] };
    },
    upsertPlacement: async (input) => {
      const existingIdx = placements.findIndex(
        (p) => p.date === input.date && p.slot === input.slot
      );
      const id = existingIdx >= 0 ? placements[existingIdx].id : `place-${++placeCounter}`;
      const row = makePlacement({
        id: existingIdx >= 0 ? placements[existingIdx].id : PLACE_ID,
        ...input,
      });

      if (existingIdx >= 0) placements[existingIdx] = row;
      else placements.push({ ...row, id });

      return placements[existingIdx >= 0 ? existingIdx : placements.length - 1];
    },
    setLeftover: async (weekId, date, slot, leftoverOfPlacementId) => {
      const source = placements.find((p) => p.id === leftoverOfPlacementId);

      if (!source) throw new Error("Leftover source placement not found in this week");
      if (source.leftoverOfPlacementId) throw new Error("Leftover source must be a cook placement");

      return deps.upsertPlacement({
        weekId,
        date,
        slot,
        recipeId: source.recipeId,
        leftoverOfPlacementId,
      });
    },
    clearPlacement: async (_weekId, date, slot) => {
      const idx = placements.findIndex((p) => p.date === date && p.slot === slot);

      if (idx >= 0) placements.splice(idx, 1);
    },
    setIngredientStatus: async (_weekId, identity, patch) => {
      const row = ingredients.find((i) => i.identity === identity);

      if (!row) throw new Error("Ingredient not found");
      if (patch.status !== undefined) row.status = patch.status;
      if (patch.checked !== undefined) row.checked = patch.checked;
    },
  };

  return { deps, recipes, placements, ingredients, getWeek: () => week };
}

const chiliBody = {
  title: "Weeknight chili",
  servings: "4",
  ingredients: [
    { name: "ground beef", quantity: "1", unit: "lb" },
    { name: "kidney beans", quantity: "2", unit: "cans" },
  ],
  steps: ["Brown the beef.", "Simmer with beans."],
};

describe("PrepPlanInputSchema", () => {
  test("accepts the plan command names", () => {
    for (const command of [
      "UPSERT_RECIPE",
      "PLACE_MEAL",
      "SET_LEFTOVER",
      "CLEAR_SLOT",
      "SET_INGREDIENT_STATUS",
      "LIST_WEEK",
      "LIST_LIBRARY",
    ] as const) {
      expect(PrepPlanInputSchema.safeParse({ command }).success).toBe(true);
    }
  });
});

describe("executePrepPlan · UPSERT_RECIPE", () => {
  test("persists a library recipe and fills clientKey from the title", async () => {
    const { deps } = makeDeps();

    const result = await executePrepPlan(
      { command: "UPSERT_RECIPE", recipe: chiliBody },
      deps
    );

    expect(result.action).toBe("upserted");
    expect(result.recipes?.[0]?.title).toBe("Weeknight chili");
    expect(result.recipes?.[0]?.clientKey).toBe("weeknight-chili");
  });

  test("errors when recipe is missing", async () => {
    const { deps } = makeDeps();
    const result = await executePrepPlan({ command: "UPSERT_RECIPE" }, deps);

    expect(result.action).toBe("error");
    expect(result.error).toContain("recipe");
  });
});

describe("executePrepPlan · PLACE_MEAL / leftovers / clear", () => {
  test("places a library recipe onto a week slot", async () => {
    const recipe = makeRecipe({ id: RECIPE_ID, title: "Chili", clientKey: "chili" });
    const { deps } = makeDeps({ recipes: [recipe] });

    const result = await executePrepPlan(
      {
        command: "PLACE_MEAL",
        date: "2026-08-11",
        slot: "dinner",
        clientKey: "chili",
        weekStart: "2026-08-10",
      },
      deps
    );

    expect(result.action).toBe("placed");
    expect(result.weekStart).toBe("2026-08-10");
    expect(result.placements?.[0]?.slot).toBe("dinner");
    expect(result.placements?.[0]?.recipeTitle).toBe("Chili");
  });

  test("marks a slot leftover of a cook placement by date+slot", async () => {
    const recipe = makeRecipe({ id: RECIPE_ID, title: "Chili", clientKey: "chili" });
    const cook = makePlacement({ id: PLACE_ID, date: "2026-08-10", slot: "dinner", recipeId: RECIPE_ID });
    const { deps } = makeDeps({
      recipes: [recipe],
      week: makeWeek(),
      placements: [cook],
    });

    const result = await executePrepPlan(
      {
        command: "SET_LEFTOVER",
        date: "2026-08-11",
        slot: "lunch",
        leftoverOfDate: "2026-08-10",
        leftoverOfSlot: "dinner",
        weekStart: "2026-08-10",
      },
      deps
    );

    expect(result.action).toBe("leftover");
    expect(result.placements?.[0]?.leftoverOfPlacementId).toBe(PLACE_ID);
    expect(result.placements?.[0]?.recipeId).toBe(RECIPE_ID);
  });

  test("clears a slot", async () => {
    const recipe = makeRecipe({ id: RECIPE_ID, title: "Chili" });
    const cook = makePlacement({ id: PLACE_ID });
    const { deps, placements } = makeDeps({
      recipes: [recipe],
      week: makeWeek(),
      placements: [cook],
    });

    const result = await executePrepPlan(
      { command: "CLEAR_SLOT", date: "2026-08-10", slot: "dinner", weekStart: "2026-08-10" },
      deps
    );

    expect(result.action).toBe("cleared");
    expect(placements).toHaveLength(0);
  });
});

describe("executePrepPlan · LIST / ingredients", () => {
  test("lists library recipes filtered by search", async () => {
    const { deps } = makeDeps({
      recipes: [
        makeRecipe({ id: RECIPE_ID, title: "Chili", clientKey: "chili" }),
        makeRecipe({ id: RECIPE_ID_B, title: "Oatmeal", clientKey: "oats" }),
      ],
    });

    const result = await executePrepPlan({ command: "LIST_LIBRARY", search: "oat" }, deps);

    expect(result.action).toBe("listed");
    expect(result.recipes?.map((r) => r.clientKey)).toEqual(["oats"]);
  });

  test("lists an empty week when none exists", async () => {
    const { deps } = makeDeps();
    const result = await executePrepPlan({ command: "LIST_WEEK", weekStart: "2026-08-10" }, deps);

    expect(result.action).toBe("listed");
    expect(result.count).toBe(0);
    expect(result.placements).toEqual([]);
  });

  test("sets shopping have/need from LIST_WEEK identity", async () => {
    const recipe = makeRecipe({ id: RECIPE_ID, title: "Chili" });
    const { deps } = makeDeps({
      recipes: [recipe],
      week: makeWeek(),
      placements: [makePlacement({ id: PLACE_ID })],
      ingredients: [
        {
          identity: "ground beef|lb",
          name: "ground beef",
          quantity: "1",
          unit: "lb",
          status: "need",
          checked: false,
        },
      ],
    });

    const result = await executePrepPlan(
      {
        command: "SET_INGREDIENT_STATUS",
        weekStart: "2026-08-10",
        identity: "ground beef|lb",
        status: "have",
        checked: true,
      },
      deps
    );

    expect(result.action).toBe("ingredient");
    expect(result.ingredients?.[0]?.status).toBe("have");
    expect(result.ingredients?.[0]?.checked).toBe(true);
  });
});

describe("executePrepPlan · unused leftover id", () => {
  test("does not treat a leftover slot as a cook source", async () => {
    const recipe = makeRecipe({ id: RECIPE_ID, title: "Chili" });
    const leftover = makePlacement({
      id: PLACE_ID_B,
      date: "2026-08-11",
      slot: "lunch",
      leftoverOfPlacementId: PLACE_ID,
    });
    const { deps } = makeDeps({
      recipes: [recipe],
      week: makeWeek(),
      placements: [leftover],
    });

    const result = await executePrepPlan(
      {
        command: "SET_LEFTOVER",
        date: "2026-08-12",
        slot: "lunch",
        leftoverOfPlacementId: PLACE_ID_B,
        weekStart: "2026-08-10",
      },
      deps
    );

    expect(result.action).toBe("error");
  });
});
