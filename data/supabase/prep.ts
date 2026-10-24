"use server";

// Tables are not in lib/supabase/types.ts until `bun run supabase:types` after
// docs/migrations/prep_tables.sql is applied (same pattern as mise_*).

import type { RecipeCardBody } from "@/lib/schemas/gen-ui/recipe-card";
import type {
  PrepPlacement,
  PrepPlacementWrite,
  PrepRecipe,
  PrepRecipePatch,
  PrepRecipeUpsert,
  PrepWeek,
  PrepWeekIngredient,
  PrepWeekIngredientStatusPatch,
} from "@/lib/schemas/prep";

import {
  PrepPlacementSchema,
  PrepPlacementWriteSchema,
  PrepRecipePatchSchema,
  PrepRecipeSchema,
  PrepRecipeUpsertSchema,
  PrepWeekIngredientSchema,
  PrepWeekIngredientStatusPatchSchema,
  PrepWeekSchema,
} from "@/lib/schemas/prep";
import {
  aggregateWeekIngredients,
  dateIsInWeek,
  mondayOf,
  recipeCardBodyFromRow,
  recipeCardBodyPatchToRow,
  recipeCardBodyToRow,
} from "@/lib/prep";
import { supabaseServer } from "@/lib/supabase/server";

type SupabaseClient = Awaited<ReturnType<typeof supabaseServer>>;

function rowToRecipe(row: Record<string, unknown>): PrepRecipe {
  return PrepRecipeSchema.parse({
    id: String(row.id),
    clientKey: String(row.client_key),
    ...recipeCardBodyFromRow(row),
  });
}

function rowToWeek(row: Record<string, unknown>): PrepWeek {
  return PrepWeekSchema.parse({
    id: String(row.id),
    weekStart: String(row.week_start),
  });
}

function rowToPlacement(row: Record<string, unknown>): PrepPlacement {
  return PrepPlacementSchema.parse({
    id: String(row.id),
    weekId: String(row.week_id),
    date: String(row.date),
    slot: row.slot,
    recipeId: String(row.recipe_id),
    leftoverOfPlacementId: (row.leftover_of_placement_id as string | null) ?? undefined,
  });
}

function rowToWeekIngredient(row: Record<string, unknown>): PrepWeekIngredient {
  return PrepWeekIngredientSchema.parse({
    identity: String(row.identity),
    name: String(row.name),
    quantity: (row.quantity as string | null) ?? undefined,
    unit: (row.unit as string | null) ?? undefined,
    category: (row.category as string | null) ?? undefined,
    status: row.status,
    checked: Boolean(row.checked),
  });
}

function recipeUpsertRow(recipe: PrepRecipeUpsert) {
  return {
    ...(recipe.id ? { id: recipe.id } : {}),
    client_key: recipe.clientKey,
    ...recipeCardBodyToRow(recipe),
  };
}

// --- recipes --------------------------------------------------------------------------

export async function listPrepRecipes(): Promise<PrepRecipe[]> {
  const supabase = await supabaseServer();
  const { data, error } = await supabase
    .from("prep_recipes")
    .select("*")
    .order("created_at", { ascending: true });

  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => rowToRecipe(row as Record<string, unknown>));
}

export async function getPrepRecipe(id: string): Promise<PrepRecipe | null> {
  const supabase = await supabaseServer();
  const { data, error } = await supabase
    .from("prep_recipes")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;

  return rowToRecipe(data as Record<string, unknown>);
}

export async function upsertPrepRecipe(input: PrepRecipeUpsert): Promise<PrepRecipe> {
  const supabase = await supabaseServer();
  const recipe = PrepRecipeUpsertSchema.parse(input);
  const { data, error } = await supabase
    .from("prep_recipes")
    .upsert(recipeUpsertRow(recipe), { onConflict: "owner_id,client_key" })
    .select("*")
    .single();

  if (error) throw new Error(error.message);

  const saved = rowToRecipe(data as Record<string, unknown>);

  await recomputeWeeksUsingRecipe(supabase, saved.id);

  return saved;
}

export async function updatePrepRecipe(id: string, patch: PrepRecipePatch): Promise<PrepRecipe> {
  const supabase = await supabaseServer();
  const p = PrepRecipePatchSchema.parse(patch);
  const update: Record<string, unknown> = recipeCardBodyPatchToRow(p as Partial<RecipeCardBody>);

  if (p.clientKey !== undefined) update.client_key = p.clientKey;
  if (Object.keys(update).length === 0) {
    const existing = await getPrepRecipe(id);

    if (!existing) throw new Error("Recipe not found");

    return existing;
  }

  const { data, error } = await supabase
    .from("prep_recipes")
    .update(update)
    .eq("id", id)
    .select("*")
    .single();

  if (error) throw new Error(error.message);

  const saved = rowToRecipe(data as Record<string, unknown>);

  await recomputeWeeksUsingRecipe(supabase, saved.id);

  return saved;
}

export async function deletePrepRecipe(id: string): Promise<void> {
  const supabase = await supabaseServer();
  const { error } = await supabase.from("prep_recipes").delete().eq("id", id);

  if (error) throw new Error(error.message);
}

// --- weeks ----------------------------------------------------------------------------

export async function ensurePrepWeek(weekStartInput: string): Promise<PrepWeek> {
  const supabase = await supabaseServer();
  const weekStart = mondayOf(weekStartInput);
  const { data, error } = await supabase
    .from("prep_weeks")
    .upsert({ week_start: weekStart }, { onConflict: "owner_id,week_start" })
    .select("*")
    .single();

  if (error) throw new Error(error.message);

  return rowToWeek(data as Record<string, unknown>);
}

export async function getPrepWeekByStart(weekStartInput: string): Promise<PrepWeek | null> {
  const supabase = await supabaseServer();
  const weekStart = mondayOf(weekStartInput);
  const { data, error } = await supabase
    .from("prep_weeks")
    .select("*")
    .eq("week_start", weekStart)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;

  return rowToWeek(data as Record<string, unknown>);
}

export type PrepWeekBundle = {
  week: PrepWeek;
  placements: PrepPlacement[];
  recipes: Record<string, PrepRecipe>;
  ingredients: PrepWeekIngredient[];
};

export async function getPrepWeekBundle(weekStartInput: string): Promise<PrepWeekBundle | null> {
  const supabase = await supabaseServer();
  const week = await getPrepWeekByStart(weekStartInput);

  if (!week) return null;

  const [
    { data: placementRows, error: placementError },
    { data: ingredientRows, error: ingError },
  ] = await Promise.all([
    supabase
      .from("prep_placements")
      .select("*")
      .eq("week_id", week.id)
      .order("date", { ascending: true }),
    supabase
      .from("prep_week_ingredients")
      .select("*")
      .eq("week_id", week.id)
      .order("identity", { ascending: true }),
  ]);

  if (placementError) throw new Error(placementError.message);
  if (ingError) throw new Error(ingError.message);

  const placements = (placementRows ?? []).map((row) =>
    rowToPlacement(row as Record<string, unknown>)
  );
  const recipeIds = [...new Set(placements.map((p) => p.recipeId))];
  const recipes: Record<string, PrepRecipe> = {};

  if (recipeIds.length > 0) {
    const { data: recipeRows, error: recipeError } = await supabase
      .from("prep_recipes")
      .select("*")
      .in("id", recipeIds);

    if (recipeError) throw new Error(recipeError.message);

    for (const row of recipeRows ?? []) {
      const recipe = rowToRecipe(row as Record<string, unknown>);

      recipes[recipe.id] = recipe;
    }
  }

  return {
    week,
    placements,
    recipes,
    ingredients: (ingredientRows ?? []).map((row) =>
      rowToWeekIngredient(row as Record<string, unknown>)
    ),
  };
}

// --- placements -----------------------------------------------------------------------

export async function upsertPrepPlacement(input: PrepPlacementWrite): Promise<PrepPlacement> {
  const supabase = await supabaseServer();
  const write = PrepPlacementWriteSchema.parse(input);
  const week = await getWeekOrThrow(supabase, write.weekId);

  if (!dateIsInWeek(write.date, week.weekStart)) {
    throw new Error("Placement date is outside the week");
  }

  if (write.leftoverOfPlacementId) {
    await assertCookPlacement(supabase, write.weekId, write.leftoverOfPlacementId);
  }

  const { data, error } = await supabase
    .from("prep_placements")
    .upsert(
      {
        week_id: write.weekId,
        date: write.date,
        slot: write.slot,
        recipe_id: write.recipeId,
        leftover_of_placement_id: write.leftoverOfPlacementId ?? null,
      },
      { onConflict: "week_id,date,slot" }
    )
    .select("*")
    .single();

  if (error) throw new Error(error.message);

  await recomputeWeekIngredients(write.weekId);

  return rowToPlacement(data as Record<string, unknown>);
}

export async function setPrepLeftover(
  weekId: string,
  date: string,
  slot: PrepPlacement["slot"],
  leftoverOfPlacementId: string
): Promise<PrepPlacement> {
  const supabase = await supabaseServer();
  const source = await assertCookPlacement(supabase, weekId, leftoverOfPlacementId);

  return upsertPrepPlacement({
    weekId,
    date,
    slot,
    recipeId: source.recipeId,
    leftoverOfPlacementId,
  });
}

export async function clearPrepPlacement(
  weekId: string,
  date: string,
  slot: PrepPlacement["slot"]
): Promise<void> {
  const supabase = await supabaseServer();
  const { error } = await supabase
    .from("prep_placements")
    .delete()
    .eq("week_id", weekId)
    .eq("date", date)
    .eq("slot", slot);

  if (error) throw new Error(error.message);

  await recomputeWeekIngredients(weekId);
}

// --- shopping -------------------------------------------------------------------------

export async function listPrepWeekIngredients(weekId: string): Promise<PrepWeekIngredient[]> {
  const supabase = await supabaseServer();
  const { data, error } = await supabase
    .from("prep_week_ingredients")
    .select("*")
    .eq("week_id", weekId)
    .order("identity", { ascending: true });

  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => rowToWeekIngredient(row as Record<string, unknown>));
}

export async function setPrepWeekIngredientStatus(
  weekId: string,
  identity: string,
  patch: PrepWeekIngredientStatusPatch
): Promise<void> {
  const supabase = await supabaseServer();
  const p = PrepWeekIngredientStatusPatchSchema.parse(patch);
  const update: Record<string, unknown> = {};

  if (p.status !== undefined) update.status = p.status;
  if (p.checked !== undefined) update.checked = p.checked;
  if (Object.keys(update).length === 0) return;

  const { error } = await supabase
    .from("prep_week_ingredients")
    .update(update)
    .eq("week_id", weekId)
    .eq("identity", identity);

  if (error) throw new Error(error.message);
}

/**
 * Rebuild shopping rows from cook placements. Have/need/checked persist when
 * the normalized name+unit identity still exists after the recompute.
 */
export async function recomputeWeekIngredients(weekId: string): Promise<PrepWeekIngredient[]> {
  const supabase = await supabaseServer();
  const [{ data: placementRows, error: placementError }, previous] = await Promise.all([
    supabase.from("prep_placements").select("*").eq("week_id", weekId),
    listPrepWeekIngredients(weekId),
  ]);

  if (placementError) throw new Error(placementError.message);

  const placements = (placementRows ?? []).map((row) =>
    rowToPlacement(row as Record<string, unknown>)
  );
  const cookRecipeIds = [
    ...new Set(placements.filter((p) => !p.leftoverOfPlacementId).map((p) => p.recipeId)),
  ];
  const recipes = new Map<string, PrepRecipe>();

  if (cookRecipeIds.length > 0) {
    const { data: recipeRows, error: recipeError } = await supabase
      .from("prep_recipes")
      .select("*")
      .in("id", cookRecipeIds);

    if (recipeError) throw new Error(recipeError.message);

    for (const row of recipeRows ?? []) {
      const recipe = rowToRecipe(row as Record<string, unknown>);

      recipes.set(recipe.id, recipe);
    }
  }

  const next = aggregateWeekIngredients(
    placements.map((p) => {
      const recipe = recipes.get(p.recipeId);

      return {
        leftoverOfPlacementId: p.leftoverOfPlacementId,
        servings: recipe?.servings,
        ingredients: recipe?.ingredients ?? [],
      };
    }),
    previous
  );

  const nextIdentities = new Set(next.map((row) => row.identity));
  const stale = previous
    .filter((row) => !nextIdentities.has(row.identity))
    .map((row) => row.identity);

  if (stale.length > 0) {
    const { error: deleteError } = await supabase
      .from("prep_week_ingredients")
      .delete()
      .eq("week_id", weekId)
      .in("identity", stale);

    if (deleteError) throw new Error(deleteError.message);
  }

  if (next.length > 0) {
    const rows = next.map((ing) => {
      const parsed = PrepWeekIngredientSchema.parse(ing);

      return {
        week_id: weekId,
        identity: parsed.identity,
        name: parsed.name,
        quantity: parsed.quantity ?? null,
        unit: parsed.unit ?? null,
        category: parsed.category ?? null,
        status: parsed.status,
        checked: parsed.checked,
      };
    });

    const { error: upsertError } = await supabase
      .from("prep_week_ingredients")
      .upsert(rows, { onConflict: "week_id,identity" });

    if (upsertError) throw new Error(upsertError.message);
  }

  return next;
}

// --- internals ------------------------------------------------------------------------

async function getWeekOrThrow(supabase: SupabaseClient, weekId: string): Promise<PrepWeek> {
  const { data, error } = await supabase
    .from("prep_weeks")
    .select("*")
    .eq("id", weekId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) throw new Error("Week not found");

  return rowToWeek(data as Record<string, unknown>);
}

async function assertCookPlacement(
  supabase: SupabaseClient,
  weekId: string,
  placementId: string
): Promise<PrepPlacement> {
  const { data, error } = await supabase
    .from("prep_placements")
    .select("*")
    .eq("id", placementId)
    .eq("week_id", weekId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) throw new Error("Leftover source placement not found in this week");

  const source = rowToPlacement(data as Record<string, unknown>);

  if (source.leftoverOfPlacementId) {
    throw new Error("Leftover source must be a cook placement");
  }

  return source;
}

async function recomputeWeeksUsingRecipe(
  supabase: SupabaseClient,
  recipeId: string
): Promise<void> {
  const { data, error } = await supabase
    .from("prep_placements")
    .select("week_id")
    .eq("recipe_id", recipeId)
    .is("leftover_of_placement_id", null);

  if (error) throw new Error(error.message);

  const weekIds = [
    ...new Set((data ?? []).map((row) => String((row as { week_id: string }).week_id))),
  ];

  for (const weekId of weekIds) {
    await recomputeWeekIngredients(weekId);
  }
}
