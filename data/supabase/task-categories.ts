"use server";

import {
  CategoryCreate,
  CategoryUpdate,
  CategoryInsert,
  CategoryPatch,
} from "@/lib/schemas/task-categories";
import { supabaseServer } from "@/lib/supabase/server";

const TASK_CATEGORY_SELECT = "*";

export async function createCategory(input: CategoryInsert) {
  const supabase = await supabaseServer();
  const payload = CategoryCreate.parse(input);

  const { data, error } = await supabase
    .from("task_categories")
    .insert({
      name: payload.name,
      color: payload.color ?? null,
      icon: payload.icon ?? null,
      sort_order: payload.sort_order ?? 0,
    })
    .select(TASK_CATEGORY_SELECT)
    .single();

  if (error) throw new Error(error.message);

  return data;
}

export async function listCategories() {
  const supabase = await supabaseServer();
  const { data, error } = await supabase
    .from("task_categories")
    .select(TASK_CATEGORY_SELECT)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });

  if (error) throw new Error(error.message);

  return data ?? [];
}

export async function updateCategory(id: string, patch: CategoryPatch) {
  const supabase = await supabaseServer();
  const payload = CategoryUpdate.parse(patch);

  const { data, error } = await supabase
    .from("task_categories")
    .update(payload)
    .eq("id", id)
    .select(TASK_CATEGORY_SELECT)
    .single();

  if (error) throw new Error(error.message);

  return data;
}

export async function deleteCategory(id: string) {
  const supabase = await supabaseServer();
  const { error } = await supabase.from("task_categories").delete().eq("id", id);

  if (error) throw new Error(error.message);

  return { ok: true };
}

/** Case-insensitive lookup by name; creates the category if missing (Aion tool path). */
export async function resolveOrCreateCategoryByName(name: string) {
  const trimmed = name.trim();

  if (!trimmed) throw new Error("Category name is required");

  const categories = await listCategories();
  const existing = categories.find(
    (category) => category.name.toLowerCase() === trimmed.toLowerCase()
  );

  if (existing) return existing;

  return createCategory({ name: trimmed });
}
