import type {
  PrepIngredientSummary,
  PrepPlacementSummary,
  PrepPlanInput,
  PrepPlanToolOutput,
  PrepRecipeSummary,
} from "@/lib/schemas/prep/plan-tool";
import type {
  PrepPlacement,
  PrepRecipe,
  PrepRecipeUpsert,
  PrepWeek,
  PrepWeekIngredient,
  PrepWeekIngredientStatusPatch,
} from "@/lib/schemas/prep";

import { mondayOf } from "@/lib/prep";
import { PrepRecipeUpsertSchema } from "@/lib/schemas/prep";

export type PrepWeekSnapshot = {
  week: PrepWeek;
  placements: PrepPlacement[];
  recipes: Record<string, PrepRecipe>;
  ingredients: PrepWeekIngredient[];
};

export type PrepPlanDeps = {
  upsertRecipe: (input: PrepRecipeUpsert) => Promise<PrepRecipe>;
  listRecipes: () => Promise<PrepRecipe[]>;
  getRecipe: (id: string) => Promise<PrepRecipe | null>;
  ensureWeek: (weekStart: string) => Promise<PrepWeek>;
  getWeekBundle: (weekStart: string) => Promise<PrepWeekSnapshot | null>;
  upsertPlacement: (input: {
    weekId: string;
    date: string;
    slot: PrepPlacement["slot"];
    recipeId: string;
    leftoverOfPlacementId?: string;
  }) => Promise<PrepPlacement>;
  setLeftover: (
    weekId: string,
    date: string,
    slot: PrepPlacement["slot"],
    leftoverOfPlacementId: string
  ) => Promise<PrepPlacement>;
  clearPlacement: (weekId: string, date: string, slot: PrepPlacement["slot"]) => Promise<void>;
  setIngredientStatus: (
    weekId: string,
    identity: string,
    patch: PrepWeekIngredientStatusPatch
  ) => Promise<void>;
};

function todayUtcIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function resolveWeekStart(weekStart?: string): string {
  return mondayOf(weekStart ?? todayUtcIso());
}

function clientKeyFromTitle(title: string): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);

  return slug || "recipe";
}

function toRecipeSummary(recipe: PrepRecipe): PrepRecipeSummary {
  return {
    id: recipe.id,
    clientKey: recipe.clientKey,
    title: recipe.title,
    complexity: recipe.complexity,
    duration: recipe.duration,
    mainProtein: recipe.mainProtein,
    mainCarbs: recipe.mainCarbs,
  };
}

function toPlacementSummary(
  placement: PrepPlacement,
  recipes: Record<string, PrepRecipe>
): PrepPlacementSummary {
  return {
    id: placement.id,
    date: placement.date,
    slot: placement.slot,
    recipeId: placement.recipeId,
    recipeTitle: recipes[placement.recipeId]?.title,
    leftoverOfPlacementId: placement.leftoverOfPlacementId,
  };
}

function toIngredientSummary(row: PrepWeekIngredient): PrepIngredientSummary {
  return {
    identity: row.identity,
    name: row.name,
    quantity: row.quantity,
    unit: row.unit,
    category: row.category,
    status: row.status,
    checked: row.checked,
  };
}

function errorOutput(message: string, extras?: Partial<PrepPlanToolOutput>): PrepPlanToolOutput {
  return { kind: "prep-plan", action: "error", count: 0, error: message, ...extras };
}

async function resolveRecipe(input: PrepPlanInput, deps: PrepPlanDeps): Promise<PrepRecipe | null> {
  if (input.recipeId) return deps.getRecipe(input.recipeId);

  const key = input.clientKey?.trim();

  if (!key) return null;

  const recipes = await deps.listRecipes();

  return recipes.find((r) => r.clientKey === key) ?? null;
}

function findCookPlacement(
  bundle: PrepWeekSnapshot,
  leftoverOfPlacementId?: string,
  leftoverOfDate?: string,
  leftoverOfSlot?: PrepPlacement["slot"]
): PrepPlacement | null {
  if (leftoverOfPlacementId) {
    const byId = bundle.placements.find((p) => p.id === leftoverOfPlacementId);

    return byId && !byId.leftoverOfPlacementId ? byId : null;
  }

  if (leftoverOfDate && leftoverOfSlot) {
    const bySlot = bundle.placements.find(
      (p) => p.date === leftoverOfDate && p.slot === leftoverOfSlot
    );

    return bySlot && !bySlot.leftoverOfPlacementId ? bySlot : null;
  }

  return null;
}

/**
 * Server-side executor for Remy `prep_plan`. Persists first via the prep data
 * layer; the dashboard reads the same tables (not a thread-owned puppet).
 */
export async function executePrepPlan(
  input: PrepPlanInput,
  deps: PrepPlanDeps
): Promise<PrepPlanToolOutput> {
  try {
    switch (input.command) {
      case "UPSERT_RECIPE": {
        if (!input.recipe) {
          return errorOutput("UPSERT_RECIPE requires recipe.");
        }

        const draft = input.recipe;
        const parsed = PrepRecipeUpsertSchema.safeParse({
          ...draft,
          clientKey: draft.clientKey?.trim() || clientKeyFromTitle(draft.title),
        });

        if (!parsed.success) {
          return errorOutput(
            "UPSERT_RECIPE recipe is invalid. Include title, ingredients, and steps."
          );
        }

        const saved = await deps.upsertRecipe(parsed.data);

        return {
          kind: "prep-plan",
          action: "upserted",
          recipes: [toRecipeSummary(saved)],
          count: 1,
        };
      }

      case "PLACE_MEAL": {
        if (!input.date || !input.slot) {
          return errorOutput("PLACE_MEAL requires date and slot.");
        }

        const recipe = await resolveRecipe(input, deps);

        if (!recipe) {
          return errorOutput(
            "PLACE_MEAL needs recipeId or clientKey of a library recipe. LIST_LIBRARY or UPSERT_RECIPE first."
          );
        }

        const weekStart = resolveWeekStart(input.weekStart ?? input.date);
        const week = await deps.ensureWeek(weekStart);
        const placement = await deps.upsertPlacement({
          weekId: week.id,
          date: input.date,
          slot: input.slot,
          recipeId: recipe.id,
        });

        return {
          kind: "prep-plan",
          action: "placed",
          weekId: week.id,
          weekStart: week.weekStart,
          placements: [toPlacementSummary(placement, { [recipe.id]: recipe })],
          recipes: [toRecipeSummary(recipe)],
          count: 1,
        };
      }

      case "SET_LEFTOVER": {
        if (!input.date || !input.slot) {
          return errorOutput("SET_LEFTOVER requires date and slot for the leftover cell.");
        }

        const weekStart = resolveWeekStart(input.weekStart ?? input.date);
        const bundle = await deps.getWeekBundle(weekStart);

        if (!bundle) {
          return errorOutput(
            "SET_LEFTOVER needs an existing week with a cook placement. PLACE_MEAL first."
          );
        }

        const source = findCookPlacement(
          bundle,
          input.leftoverOfPlacementId,
          input.leftoverOfDate,
          input.leftoverOfSlot
        );

        if (!source) {
          return errorOutput(
            "SET_LEFTOVER needs leftoverOfPlacementId or leftoverOfDate + leftoverOfSlot pointing at a cook slot."
          );
        }

        const placement = await deps.setLeftover(bundle.week.id, input.date, input.slot, source.id);

        return {
          kind: "prep-plan",
          action: "leftover",
          weekId: bundle.week.id,
          weekStart: bundle.week.weekStart,
          placements: [toPlacementSummary(placement, bundle.recipes)],
          count: 1,
        };
      }

      case "CLEAR_SLOT": {
        if (!input.date || !input.slot) {
          return errorOutput("CLEAR_SLOT requires date and slot.");
        }

        const weekStart = resolveWeekStart(input.weekStart ?? input.date);
        const bundle = await deps.getWeekBundle(weekStart);

        if (!bundle) {
          return errorOutput("CLEAR_SLOT: no week found for that date.");
        }

        await deps.clearPlacement(bundle.week.id, input.date, input.slot);

        return {
          kind: "prep-plan",
          action: "cleared",
          weekId: bundle.week.id,
          weekStart: bundle.week.weekStart,
          count: 1,
        };
      }

      case "SET_INGREDIENT_STATUS": {
        if (!input.identity) {
          return errorOutput("SET_INGREDIENT_STATUS requires identity from LIST_WEEK.");
        }

        if (input.status === undefined && input.checked === undefined) {
          return errorOutput("SET_INGREDIENT_STATUS requires status and/or checked.");
        }

        const weekStart = resolveWeekStart(input.weekStart);
        const bundle = await deps.getWeekBundle(weekStart);

        if (!bundle) {
          return errorOutput("SET_INGREDIENT_STATUS: no week found. LIST_WEEK first.");
        }

        await deps.setIngredientStatus(bundle.week.id, input.identity, {
          status: input.status,
          checked: input.checked,
        });

        const next = bundle.ingredients.find((row) => row.identity === input.identity);
        const updated: PrepIngredientSummary = {
          identity: input.identity,
          name: next?.name ?? input.identity,
          quantity: next?.quantity,
          unit: next?.unit,
          category: next?.category,
          status: input.status ?? next?.status ?? "need",
          checked: input.checked ?? next?.checked ?? false,
        };

        return {
          kind: "prep-plan",
          action: "ingredient",
          weekId: bundle.week.id,
          weekStart: bundle.week.weekStart,
          ingredients: [updated],
          count: 1,
        };
      }

      case "LIST_WEEK": {
        const weekStart = resolveWeekStart(input.weekStart);
        const bundle = await deps.getWeekBundle(weekStart);

        if (!bundle) {
          return {
            kind: "prep-plan",
            action: "listed",
            weekStart,
            placements: [],
            ingredients: [],
            recipes: [],
            count: 0,
          };
        }

        return {
          kind: "prep-plan",
          action: "listed",
          weekId: bundle.week.id,
          weekStart: bundle.week.weekStart,
          placements: bundle.placements.map((p) => toPlacementSummary(p, bundle.recipes)),
          ingredients: bundle.ingredients.map(toIngredientSummary),
          recipes: Object.values(bundle.recipes).map(toRecipeSummary),
          count: bundle.placements.length,
        };
      }

      case "LIST_LIBRARY": {
        const all = await deps.listRecipes();
        const search = input.search?.trim().toLowerCase();
        const filtered = search
          ? all.filter(
              (r) => r.title.toLowerCase().includes(search) || r.clientKey.includes(search)
            )
          : all;

        return {
          kind: "prep-plan",
          action: "listed",
          recipes: filtered.map(toRecipeSummary),
          count: filtered.length,
        };
      }

      default:
        return errorOutput("Unknown command.");
    }
  } catch (error) {
    return errorOutput(error instanceof Error ? error.message : "Failed to update the week plan.");
  }
}
