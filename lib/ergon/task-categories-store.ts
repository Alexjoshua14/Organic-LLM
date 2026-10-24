"use client";

import type { TaskCategoryRow } from "@/lib/ergon/types";

import { createPersistentStore } from "@/lib/client-store/persistent-store";

type CategoryStoreState = {
  categories: TaskCategoryRow[];
  updatedAt: number;
};

function validatePersistedState(raw: unknown): CategoryStoreState | null {
  if (!raw || typeof raw !== "object") return null;

  const categories = (raw as { categories?: unknown }).categories;

  if (!Array.isArray(categories)) return null;

  return {
    categories: categories as TaskCategoryRow[],
    updatedAt: Date.now(),
  };
}

const store = createPersistentStore<CategoryStoreState>(
  "organic-llm.ergon.categories.v1",
  { categories: [], updatedAt: 0 },
  { validate: validatePersistedState }
);

export function getCachedCategories(): TaskCategoryRow[] {
  return store.getState().categories;
}

export function setCachedCategories(categories: TaskCategoryRow[]): void {
  store.setState((prev) => ({ ...prev, categories, updatedAt: Date.now() }));
}

export function useCachedCategories(): TaskCategoryRow[] {
  return store.useStore((state) => state.categories);
}
