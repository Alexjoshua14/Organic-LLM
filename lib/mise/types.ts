import type { PlanTimelineStep } from "@/lib/schemas/gen-ui";
import type { MiseIngredient, MiseRecipe } from "@/lib/schemas/mise";

/** The event header as held in the normalized plan (mirrors MiseEvent, minus nested arrays). */
export type MisePlanEvent = {
  /** Client/LLM id (defaults to "event"). */
  id: string;
  title: string;
  date?: string;
  time?: string;
  location?: string;
  guestCount?: number;
  notes?: string;
};

export type MisePlanStatus = "initializing" | "ready";

/**
 * Normalized plan for a single thread. Recipes/ingredients are keyed by their client id with
 * parallel insertion-order arrays (mirrors the kanban board store shape). Shared by the server
 * data layer (hydrate) and the client store (live reduce) so one shape flows end to end.
 */
export type MisePlanState = {
  event: MisePlanEvent;
  /** Supabase UUID once persisted; absent for an optimistic, not-yet-saved plan. */
  serverEventId?: string;
  recipes: Record<string, MiseRecipe>;
  recipeOrder: string[];
  ingredients: Record<string, MiseIngredient>;
  ingredientOrder: string[];
  timeline: PlanTimelineStep[];
  status: MisePlanStatus;
  /** Id of the most recently summoned view. */
  activeViewId?: string;
};

export function emptyMisePlan(title = "Plan"): MisePlanState {
  return {
    event: { id: "event", title },
    recipes: {},
    recipeOrder: [],
    ingredients: {},
    ingredientOrder: [],
    timeline: [],
    status: "initializing",
  };
}
