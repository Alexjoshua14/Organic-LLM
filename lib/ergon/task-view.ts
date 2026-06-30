import type { z } from "zod";
import type { ErgonFilters, ListSort, TaskCategoryRow, TaskWithCategory } from "@/lib/ergon/types";

import { MentalEffort, TaskPriority, TaskStatus } from "@/lib/schemas/tasks";

type TaskPriorityValue = z.infer<typeof TaskPriority>;
type MentalEffortValue = z.infer<typeof MentalEffort>;
type TaskStatusValue = z.infer<typeof TaskStatus>;

const PRIORITY_ORDER: Record<string, number> = {
  urgent: 0,
  high: 1,
  medium: 2,
  low: 3,
};

export function isOpenTask(status: string): boolean {
  return status === "todo" || status === "doing";
}

export function isDoneViewTask(status: string): boolean {
  return status === "done" || status === "archived";
}

export function isErgonFiltersActive(filters: ErgonFilters): boolean {
  return (
    filters.search.trim().length > 0 ||
    filters.categoryIds.length > 0 ||
    filters.priorities.length > 0 ||
    filters.mentalEfforts.length > 0 ||
    filters.statuses.length > 0
  );
}

export function filterTasks(tasks: TaskWithCategory[], filters: ErgonFilters): TaskWithCategory[] {
  const query = filters.search.trim().toLowerCase();

  return tasks.filter((task) => {
    if (query) {
      const inTitle = task.title.toLowerCase().includes(query);
      const inNotes = task.notes?.toLowerCase().includes(query) ?? false;

      if (!inTitle && !inNotes) return false;
    }

    if (
      filters.categoryIds.length > 0 &&
      (!task.category_id || !filters.categoryIds.includes(task.category_id))
    ) {
      return false;
    }

    if (
      filters.priorities.length > 0 &&
      (!task.priority || !filters.priorities.includes(task.priority as TaskPriorityValue))
    ) {
      return false;
    }

    if (
      filters.mentalEfforts.length > 0 &&
      (!task.mental_effort ||
        !filters.mentalEfforts.includes(task.mental_effort as MentalEffortValue))
    ) {
      return false;
    }

    if (filters.statuses.length > 0 && !filters.statuses.includes(task.status as TaskStatusValue)) {
      return false;
    }

    return true;
  });
}

export function sortTasksBy(tasks: TaskWithCategory[], sort: ListSort): TaskWithCategory[] {
  return [...tasks].sort((a, b) => {
    if (sort === "priority") {
      const pa = a.priority ? (PRIORITY_ORDER[a.priority] ?? 99) : 99;
      const pb = b.priority ? (PRIORITY_ORDER[b.priority] ?? 99) : 99;

      if (pa !== pb) return pa - pb;
    }

    if (sort === "due") {
      const da = a.due_date ?? "9999-12-31";
      const db = b.due_date ?? "9999-12-31";

      if (da !== db) return da.localeCompare(db);
    }

    return a.title.localeCompare(b.title);
  });
}

export function sortDoneTasks(tasks: TaskWithCategory[]): TaskWithCategory[] {
  return [...tasks].sort((a, b) => {
    const ca = a.completed_at ?? a.updated_at;
    const cb = b.completed_at ?? b.updated_at;

    return cb.localeCompare(ca);
  });
}

export type CategoryTaskGroup = {
  categoryId: string | null;
  label: string;
  color: string | null;
  tasks: TaskWithCategory[];
};

export function groupTasksByCategory(
  tasks: TaskWithCategory[],
  categories: TaskCategoryRow[]
): CategoryTaskGroup[] {
  const byCategory = new Map<string | null, TaskWithCategory[]>();

  for (const task of tasks) {
    const key = task.category_id;
    const list = byCategory.get(key) ?? [];

    list.push(task);
    byCategory.set(key, list);
  }

  const groups: CategoryTaskGroup[] = [];

  for (const category of categories) {
    const categoryTasks = byCategory.get(category.id);

    if (categoryTasks?.length) {
      groups.push({
        categoryId: category.id,
        label: category.name,
        color: category.color,
        tasks: categoryTasks,
      });
      byCategory.delete(category.id);
    }
  }

  const uncategorized = byCategory.get(null);

  if (uncategorized?.length) {
    groups.push({
      categoryId: null,
      label: "Uncategorized",
      color: null,
      tasks: uncategorized,
    });
    byCategory.delete(null);
  }

  for (const [categoryId, categoryTasks] of byCategory) {
    if (!categoryId || categoryTasks.length === 0) continue;

    const category = categories.find((item) => item.id === categoryId);

    groups.push({
      categoryId,
      label: category?.name ?? "Unknown",
      color: category?.color ?? null,
      tasks: categoryTasks,
    });
  }

  return groups;
}
