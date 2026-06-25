"use server";

import type { PlanTimelineStep } from "@/lib/schemas/gen-ui";
import type {
  MiseCommand,
  MiseEvent,
  MiseIngredient,
  MiseRecipe,
  MiseRecipePatch,
} from "@/lib/schemas/mise";
import type { MisePlanState } from "@/lib/mise/types";

import {
  MiseCommandSchema,
  MiseEventSchema,
  MiseIngredientSchema,
  MiseRecipePatchSchema,
  MiseRecipeSchema,
} from "@/lib/schemas/mise";
import { emptyMisePlan } from "@/lib/mise/types";
import { supabaseServer } from "@/lib/supabase/server";

type SupabaseClient = Awaited<ReturnType<typeof supabaseServer>>;

// --- row → domain mappers -------------------------------------------------------------

function rowToRecipe(row: Record<string, unknown>): MiseRecipe {
  return {
    id: String(row.client_key),
    title: String(row.title),
    sourceUrl: (row.source_url as string | null) ?? undefined,
    servings: (row.servings as string | null) ?? undefined,
    prepTime: (row.prep_time as string | null) ?? undefined,
    cookTime: (row.cook_time as string | null) ?? undefined,
    ingredients: (row.ingredients as MiseRecipe["ingredients"]) ?? [],
    steps: (row.steps as string[] | null) ?? [],
    notes: (row.notes as string | null) ?? undefined,
  };
}

function rowToIngredient(row: Record<string, unknown>): MiseIngredient {
  return {
    id: String(row.client_key),
    recipeId: (row.recipe_key as string | null) ?? undefined,
    name: String(row.name),
    quantity: (row.quantity as string | null) ?? undefined,
    unit: (row.unit as string | null) ?? undefined,
    category: (row.category as string | null) ?? undefined,
    status: (row.status as MiseIngredient["status"]) ?? "need",
    checked: Boolean(row.checked),
  };
}

// --- event ----------------------------------------------------------------------------

/** Upsert the thread's event (one per thread) and return its Supabase UUID. */
export async function ensureEvent(threadId: string, eventInput: MiseEvent): Promise<string> {
  const supabase = await supabaseServer();
  const event = MiseEventSchema.parse(eventInput);

  const { data, error } = await supabase
    .from("mise_events")
    .upsert(
      {
        thread_id: threadId,
        title: event.title,
        event_date: event.date ?? null,
        event_time: event.time ?? null,
        location: event.location ?? null,
        guest_count: event.guestCount ?? null,
        notes: event.notes ?? null,
        timeline: event.timeline ?? [],
      },
      { onConflict: "thread_id" }
    )
    .select("id")
    .single();

  if (error) throw new Error(error.message);

  return data.id as string;
}

async function getEventIdByThread(
  supabase: SupabaseClient,
  threadId: string
): Promise<string | null> {
  const { data, error } = await supabase
    .from("mise_events")
    .select("id")
    .eq("thread_id", threadId)
    .maybeSingle();

  if (error) throw new Error(error.message);

  return data ? (data.id as string) : null;
}

export async function setTimeline(eventId: string, steps: PlanTimelineStep[]): Promise<void> {
  const supabase = await supabaseServer();
  const { error } = await supabase
    .from("mise_events")
    .update({ timeline: steps })
    .eq("id", eventId);

  if (error) throw new Error(error.message);
}

// --- recipes --------------------------------------------------------------------------

export async function upsertRecipes(eventId: string, recipes: MiseRecipe[]): Promise<void> {
  const supabase = await supabaseServer();
  const rows = recipes.map((r) => {
    const recipe = MiseRecipeSchema.parse(r);

    return {
      event_id: eventId,
      client_key: recipe.id,
      title: recipe.title,
      source_url: recipe.sourceUrl ?? null,
      servings: recipe.servings ?? null,
      prep_time: recipe.prepTime ?? null,
      cook_time: recipe.cookTime ?? null,
      ingredients: recipe.ingredients,
      steps: recipe.steps,
      notes: recipe.notes ?? null,
    };
  });

  const { error } = await supabase
    .from("mise_recipes")
    .upsert(rows, { onConflict: "event_id,client_key" });

  if (error) throw new Error(error.message);
}

/** Patch a single recipe's provided columns (does not require a full recipe). */
export async function updateRecipe(
  eventId: string,
  clientKey: string,
  patch: MiseRecipePatch
): Promise<void> {
  const supabase = await supabaseServer();
  const p = MiseRecipePatchSchema.parse(patch);
  const update: Record<string, unknown> = {};

  if (p.title !== undefined) update.title = p.title;
  if (p.sourceUrl !== undefined) update.source_url = p.sourceUrl;
  if (p.servings !== undefined) update.servings = p.servings;
  if (p.prepTime !== undefined) update.prep_time = p.prepTime;
  if (p.cookTime !== undefined) update.cook_time = p.cookTime;
  if (p.ingredients !== undefined) update.ingredients = p.ingredients;
  if (p.steps !== undefined) update.steps = p.steps;
  if (p.notes !== undefined) update.notes = p.notes;
  if (Object.keys(update).length === 0) return;

  const { error } = await supabase
    .from("mise_recipes")
    .update(update)
    .eq("event_id", eventId)
    .eq("client_key", clientKey);

  if (error) throw new Error(error.message);
}

export async function removeRecipe(eventId: string, clientKey: string): Promise<void> {
  const supabase = await supabaseServer();
  const { error } = await supabase
    .from("mise_recipes")
    .delete()
    .eq("event_id", eventId)
    .eq("client_key", clientKey);

  if (error) throw new Error(error.message);
}

// --- ingredients ----------------------------------------------------------------------

export async function upsertIngredients(
  eventId: string,
  ingredients: MiseIngredient[]
): Promise<void> {
  const supabase = await supabaseServer();
  const rows = ingredients.map((i) => {
    const ing = MiseIngredientSchema.parse(i);

    return {
      event_id: eventId,
      client_key: ing.id,
      recipe_key: ing.recipeId ?? null,
      name: ing.name,
      quantity: ing.quantity ?? null,
      unit: ing.unit ?? null,
      category: ing.category ?? null,
      status: ing.status,
      checked: ing.checked,
    };
  });

  const { error } = await supabase
    .from("mise_ingredients")
    .upsert(rows, { onConflict: "event_id,client_key" });

  if (error) throw new Error(error.message);
}

export async function setIngredientStatus(
  eventId: string,
  clientKey: string,
  patch: { status?: MiseIngredient["status"]; checked?: boolean }
): Promise<void> {
  const supabase = await supabaseServer();
  const update: Record<string, unknown> = {};

  if (patch.status !== undefined) update.status = patch.status;
  if (patch.checked !== undefined) update.checked = patch.checked;
  if (Object.keys(update).length === 0) return;

  const { error } = await supabase
    .from("mise_ingredients")
    .update(update)
    .eq("event_id", eventId)
    .eq("client_key", clientKey);

  if (error) throw new Error(error.message);
}

export async function removeIngredient(eventId: string, clientKey: string): Promise<void> {
  const supabase = await supabaseServer();
  const { error } = await supabase
    .from("mise_ingredients")
    .delete()
    .eq("event_id", eventId)
    .eq("client_key", clientKey);

  if (error) throw new Error(error.message);
}

// --- orchestration --------------------------------------------------------------------

/**
 * Persist a single validated command for a thread. Returns the Supabase event UUID (or null
 * when the plan does not yet exist and the command isn't INITIATE_PLAN). The mise_plan tool
 * calls this; the client store handles the live, optimistic render in parallel.
 */
export async function applyMiseCommand(
  threadId: string,
  rawCommand: MiseCommand
): Promise<string | null> {
  const command = MiseCommandSchema.parse(rawCommand);
  const supabase = await supabaseServer();

  if (command.type === "INITIATE_PLAN") {
    const eventId = await ensureEvent(threadId, command.event);

    if (command.seedRecipes?.length) await upsertRecipes(eventId, command.seedRecipes);
    if (command.seedIngredients?.length) await upsertIngredients(eventId, command.seedIngredients);

    return eventId;
  }

  const eventId = await getEventIdByThread(supabase, threadId);

  if (!eventId) return null;

  switch (command.type) {
    case "SET_TIMELINE":
      await setTimeline(eventId, command.steps);
      break;
    case "UPSERT_RECIPES":
      await upsertRecipes(eventId, command.recipes);
      break;
    case "UPDATE_RECIPE":
      await updateRecipe(eventId, command.id, { ...command.patch, id: command.id });
      break;
    case "REMOVE_RECIPE":
      await removeRecipe(eventId, command.id);
      break;
    case "UPSERT_INGREDIENTS":
      await upsertIngredients(eventId, command.ingredients);
      break;
    case "SET_INGREDIENT_STATUS":
      await setIngredientStatus(eventId, command.id, {
        status: command.status,
        checked: command.checked,
      });
      break;
    case "REMOVE_INGREDIENT":
      await removeIngredient(eventId, command.id);
      break;
    case "SHOW_VIEW":
      // Views are not persisted — they render against the current plan.
      break;
  }

  return eventId;
}

/** Hydrate the normalized plan for a thread, or null if no plan exists yet. */
export async function getPlanByThread(threadId: string): Promise<MisePlanState | null> {
  const supabase = await supabaseServer();

  const { data: event, error: eventError } = await supabase
    .from("mise_events")
    .select("*")
    .eq("thread_id", threadId)
    .maybeSingle();

  if (eventError) throw new Error(eventError.message);
  if (!event) return null;

  const [{ data: recipeRows, error: recipeError }, { data: ingredientRows, error: ingError }] =
    await Promise.all([
      supabase
        .from("mise_recipes")
        .select("*")
        .eq("event_id", event.id)
        .order("created_at", { ascending: true }),
      supabase
        .from("mise_ingredients")
        .select("*")
        .eq("event_id", event.id)
        .order("created_at", { ascending: true }),
    ]);

  if (recipeError) throw new Error(recipeError.message);
  if (ingError) throw new Error(ingError.message);

  const plan: MisePlanState = emptyMisePlan(event.title as string);

  plan.status = "ready";
  plan.serverEventId = event.id as string;
  plan.event = {
    id: "event",
    title: event.title as string,
    date: (event.event_date as string | null) ?? undefined,
    time: (event.event_time as string | null) ?? undefined,
    location: (event.location as string | null) ?? undefined,
    guestCount: (event.guest_count as number | null) ?? undefined,
    notes: (event.notes as string | null) ?? undefined,
  };
  plan.timeline = (event.timeline as PlanTimelineStep[] | null) ?? [];

  for (const row of recipeRows ?? []) {
    const recipe = rowToRecipe(row as Record<string, unknown>);

    plan.recipes[recipe.id] = recipe;
    plan.recipeOrder.push(recipe.id);
  }

  for (const row of ingredientRows ?? []) {
    const ing = rowToIngredient(row as Record<string, unknown>);

    plan.ingredients[ing.id] = ing;
    plan.ingredientOrder.push(ing.id);
  }

  return plan;
}
