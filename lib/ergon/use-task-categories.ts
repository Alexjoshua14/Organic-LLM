"use client";

import type { TaskCategoryRow } from "@/lib/ergon/types";
import type { CategoryInsert, CategoryPatch } from "@/lib/schemas/task-categories";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import {
  actionCreateCategory,
  actionDeleteCategory,
  actionListCategories,
  actionUpdateCategory,
} from "@/app/actions/task-categories";
import {
  getCachedCategories,
  setCachedCategories,
  useCachedCategories,
} from "@/lib/ergon/task-categories-store";

export function useTaskCategories(initialCategories: TaskCategoryRow[]) {
  const cached = useCachedCategories();
  const [categories, setCategories] = useState<TaskCategoryRow[]>(() => {
    if (cached.length > 0) return cached;
    if (initialCategories.length > 0) return initialCategories;

    return getCachedCategories();
  });
  const [syncing, setSyncing] = useState(false);

  const reconcile = useCallback((next: TaskCategoryRow[]) => {
    setCategories(next);
    setCachedCategories(next);
  }, []);

  const refresh = useCallback(async () => {
    setSyncing(true);

    try {
      const fresh = await actionListCategories();

      reconcile(fresh);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to refresh categories");
    } finally {
      setSyncing(false);
    }
  }, [reconcile]);

  useEffect(() => {
    if (initialCategories.length > 0 && categories.length === 0) {
      reconcile(initialCategories);
    }
  }, [categories.length, initialCategories, reconcile]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const createCategory = useCallback(async (input: CategoryInsert) => {
    const tempId = `temp-cat-${crypto.randomUUID()}`;
    const optimistic: TaskCategoryRow = {
      id: tempId,
      name: input.name,
      color: input.color ?? null,
      icon: input.icon ?? null,
      sort_order: input.sort_order ?? 0,
      owner_id: "",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    setCategories((prev) => [...prev, optimistic]);

    try {
      const row = await actionCreateCategory(input);

      setCategories((prev) => {
        const next = prev.map((item) => (item.id === tempId ? row : item));

        setCachedCategories(next);

        return next;
      });

      return row;
    } catch (error) {
      setCategories((prev) => prev.filter((item) => item.id !== tempId));
      toast.error(error instanceof Error ? error.message : "Failed to create category");
      throw error;
    }
  }, []);

  const updateCategory = useCallback(
    async (id: string, patch: CategoryPatch) => {
      const previous = categories;
      const optimistic = categories.map((item) =>
        item.id === id ? { ...item, ...patch, updated_at: new Date().toISOString() } : item
      );

      setCategories(optimistic);
      setCachedCategories(optimistic);

      try {
        const row = await actionUpdateCategory(id, patch);

        setCategories((prev) => {
          const next = prev.map((item) => (item.id === id ? row : item));

          setCachedCategories(next);

          return next;
        });

        return row;
      } catch (error) {
        setCategories(previous);
        setCachedCategories(previous);
        toast.error(error instanceof Error ? error.message : "Failed to update category");
        throw error;
      }
    },
    [categories]
  );

  const deleteCategory = useCallback(
    async (id: string) => {
      const previous = categories;
      const optimistic = categories.filter((item) => item.id !== id);

      setCategories(optimistic);
      setCachedCategories(optimistic);

      try {
        await actionDeleteCategory(id);
      } catch (error) {
        setCategories(previous);
        setCachedCategories(previous);
        toast.error(error instanceof Error ? error.message : "Failed to delete category");
        throw error;
      }
    },
    [categories]
  );

  return {
    categories,
    syncing,
    refresh,
    createCategory,
    updateCategory,
    deleteCategory,
  };
}
