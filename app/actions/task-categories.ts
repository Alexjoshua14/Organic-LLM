"use server";

import type { CategoryInsert, CategoryPatch } from "@/lib/schemas/task-categories";

import { revalidateTag } from "next/cache";

import {
  createCategory,
  deleteCategory,
  listCategories,
  updateCategory,
} from "@/data/supabase/task-categories";

function revalidateCategories() {
  revalidateTag("task-categories", "max");
}

export async function actionListCategories() {
  return listCategories();
}

export async function actionCreateCategory(input: CategoryInsert) {
  const row = await createCategory(input);

  revalidateCategories();

  return row;
}

export async function actionUpdateCategory(id: string, patch: CategoryPatch) {
  const row = await updateCategory(id, patch);

  revalidateCategories();

  return row;
}

export async function actionDeleteCategory(id: string) {
  await deleteCategory(id);
  revalidateCategories();

  return { ok: true as const };
}
