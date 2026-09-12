import type { PrepPlanDeps } from "@/lib/llm/prep-plan-execute";

import { tool } from "ai";

import {
  clearPrepPlacement,
  ensurePrepWeek,
  getPrepRecipe,
  getPrepWeekBundle,
  listPrepRecipes,
  setPrepLeftover,
  setPrepWeekIngredientStatus,
  upsertPrepPlacement,
  upsertPrepRecipe,
} from "@/data/supabase/prep";
import { executePrepPlan } from "@/lib/llm/prep-plan-execute";
import { createLogger } from "@/lib/logger";
import { PrepPlanInputSchema } from "@/lib/schemas/prep";

export { PREP_PLAN_TOOL_NAME } from "@/lib/schemas/prep";

const logger = createLogger("lib/llm/prep-plan-tool.ts");

const realDeps: PrepPlanDeps = {
  upsertRecipe: upsertPrepRecipe,
  listRecipes: listPrepRecipes,
  getRecipe: getPrepRecipe,
  ensureWeek: ensurePrepWeek,
  getWeekBundle: getPrepWeekBundle,
  upsertPlacement: upsertPrepPlacement,
  setLeftover: setPrepLeftover,
  clearPlacement: clearPrepPlacement,
  setIngredientStatus: setPrepWeekIngredientStatus,
};

/**
 * Remy weekly meal-prep tool. Persists via the prep data layer (RLS-scoped) so
 * the /remy dashboard and /remy/[id] threads share the same library and week.
 */
export function createPrepPlanTool(deps: PrepPlanDeps = realDeps) {
  return tool({
    description:
      "Manage the user's durable weekly meal plan and recipe library: UPSERT_RECIPE, PLACE_MEAL, SET_LEFTOVER, CLEAR_SLOT, SET_INGREDIENT_STATUS, LIST_WEEK, LIST_LIBRARY. Persists to the database and is shared with the /remy dashboard. Prefer leftovers and ingredient reuse across the week. Use mise_plan for one-off gatherings, not weeks.",
    inputSchema: PrepPlanInputSchema,
    execute: async (input) => {
      const result = await executePrepPlan(input, deps);

      logger.log("prep_plan", "executed", {
        command: input.command,
        action: result.action,
        count: result.count,
        error: result.error,
      });

      return result;
    },
  });
}
