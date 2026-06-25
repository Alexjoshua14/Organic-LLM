"use client";

import type { MiseCommand, MiseIngredient, MiseRecipe } from "@/lib/schemas/mise";
import type { MisePlanState } from "@/lib/mise/types";

import { createPersistentStore } from "@/lib/client-store/persistent-store";
import { emptyMisePlan } from "@/lib/mise/types";

export type MiseStoreState = {
  plans: Record<string, MisePlanState>;
};

function isPlan(value: unknown): value is MisePlanState {
  if (!value || typeof value !== "object") return false;
  const p = value as Partial<MisePlanState>;

  return (
    typeof p.event === "object" &&
    p.event !== null &&
    typeof p.recipes === "object" &&
    Array.isArray(p.recipeOrder) &&
    typeof p.ingredients === "object" &&
    Array.isArray(p.ingredientOrder)
  );
}

/** Keep only structurally-sound plans from a persisted blob; drop the rest. */
function validatePersistedState(raw: unknown): MiseStoreState | null {
  if (!raw || typeof raw !== "object") return null;
  const plansRaw = (raw as { plans?: unknown }).plans;

  if (!plansRaw || typeof plansRaw !== "object") return null;

  const plans: Record<string, MisePlanState> = {};

  for (const [threadId, plan] of Object.entries(plansRaw as Record<string, unknown>)) {
    if (isPlan(plan)) plans[threadId] = plan;
  }

  return { plans };
}

const store = createPersistentStore<MiseStoreState>(
  "organic-llm.mise.v1",
  { plans: {} },
  { validate: validatePersistedState }
);

function upsertRecipe(plan: MisePlanState, recipe: MiseRecipe): void {
  const existing = plan.recipes[recipe.id];

  plan.recipes[recipe.id] = { ...existing, ...recipe };
  if (!existing) plan.recipeOrder.push(recipe.id);
}

function upsertIngredient(plan: MisePlanState, ingredient: MiseIngredient): void {
  const existing = plan.ingredients[ingredient.id];

  plan.ingredients[ingredient.id] = { ...existing, ...ingredient };
  if (!existing) plan.ingredientOrder.push(ingredient.id);
}

function clonePlan(prev: MisePlanState | undefined): MisePlanState {
  if (!prev) return emptyMisePlan();

  return {
    ...prev,
    event: { ...prev.event },
    recipes: { ...prev.recipes },
    recipeOrder: [...prev.recipeOrder],
    ingredients: { ...prev.ingredients },
    ingredientOrder: [...prev.ingredientOrder],
    timeline: [...prev.timeline],
  };
}

/**
 * Pure reducer: apply a single validated command to a plan, returning the next plan.
 * Exported for unit testing and reuse. Persistence is the server's job (data/supabase/mise.ts);
 * this drives the live, optimistic client render.
 */
export function reduceMisePlan(
  prev: MisePlanState | undefined,
  command: MiseCommand
): MisePlanState {
  switch (command.type) {
    case "INITIATE_PLAN": {
      const plan = emptyMisePlan(command.event.title);

      plan.event = {
        id: command.event.id ?? "event",
        title: command.event.title,
        date: command.event.date,
        time: command.event.time,
        location: command.event.location,
        guestCount: command.event.guestCount,
        notes: command.event.notes,
      };
      plan.timeline = command.event.timeline ?? [];

      for (const recipe of command.seedRecipes ?? []) upsertRecipe(plan, recipe);
      for (const ingredient of command.seedIngredients ?? []) upsertIngredient(plan, ingredient);

      const seeded =
        (command.seedRecipes?.length ?? 0) > 0 ||
        (command.seedIngredients?.length ?? 0) > 0 ||
        plan.timeline.length > 0;

      plan.status = seeded ? "ready" : "initializing";

      return plan;
    }

    case "SET_TIMELINE": {
      const plan = clonePlan(prev);

      plan.timeline = command.steps;
      plan.status = "ready";

      return plan;
    }

    case "UPSERT_RECIPES": {
      const plan = clonePlan(prev);

      for (const recipe of command.recipes) upsertRecipe(plan, recipe);
      plan.status = "ready";

      return plan;
    }

    case "UPDATE_RECIPE": {
      if (!prev?.recipes[command.id]) return prev ?? emptyMisePlan();
      const plan = clonePlan(prev);

      plan.recipes[command.id] = { ...plan.recipes[command.id], ...command.patch, id: command.id };

      return plan;
    }

    case "REMOVE_RECIPE": {
      if (!prev?.recipes[command.id]) return prev ?? emptyMisePlan();
      const plan = clonePlan(prev);

      delete plan.recipes[command.id];
      plan.recipeOrder = plan.recipeOrder.filter((id) => id !== command.id);

      return plan;
    }

    case "UPSERT_INGREDIENTS": {
      const plan = clonePlan(prev);

      for (const ingredient of command.ingredients) upsertIngredient(plan, ingredient);
      plan.status = "ready";

      return plan;
    }

    case "SET_INGREDIENT_STATUS": {
      if (!prev?.ingredients[command.id]) return prev ?? emptyMisePlan();
      const plan = clonePlan(prev);
      const current = plan.ingredients[command.id];

      plan.ingredients[command.id] = {
        ...current,
        ...(command.status !== undefined ? { status: command.status } : {}),
        ...(command.checked !== undefined ? { checked: command.checked } : {}),
      };

      return plan;
    }

    case "REMOVE_INGREDIENT": {
      if (!prev?.ingredients[command.id]) return prev ?? emptyMisePlan();
      const plan = clonePlan(prev);

      delete plan.ingredients[command.id];
      plan.ingredientOrder = plan.ingredientOrder.filter((id) => id !== command.id);

      return plan;
    }

    case "SHOW_VIEW": {
      const plan = clonePlan(prev);

      plan.activeViewId = command.view.id;

      return plan;
    }
  }
}

export function applyMiseCommand(threadId: string, command: MiseCommand): void {
  store.setState((prev) => {
    const next = reduceMisePlan(prev.plans[threadId], command);

    return { plans: { ...prev.plans, [threadId]: next } };
  });
}

/** Replace a thread's plan wholesale (used when hydrating from Supabase). */
export function setMisePlan(threadId: string, plan: MisePlanState): void {
  store.setState((prev) => ({ plans: { ...prev.plans, [threadId]: plan } }));
}

export function getMisePlan(threadId: string): MisePlanState | undefined {
  return store.getState().plans[threadId];
}

export function resetMisePlan(threadId: string): void {
  store.setState((prev) => {
    if (!prev.plans[threadId]) return prev;
    const plans = { ...prev.plans };

    delete plans[threadId];

    return { plans };
  });
}

/** React hook: subscribe to a single thread's plan. */
export function useMisePlan(threadId: string): MisePlanState | undefined {
  return store.useStore((s) => s.plans[threadId]);
}

export const __miseStoreForTests = store;
