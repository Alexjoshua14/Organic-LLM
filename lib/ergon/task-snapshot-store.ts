"use client";

import type { TaskWithCategory } from "@/lib/ergon/types";

import { createPersistentStore } from "@/lib/client-store/persistent-store";
import { canCacheErgonSnapshot, ERGON_TASK_SNAPSHOT_STORAGE_KEY } from "@/lib/ergon/offline";

type TaskSnapshotState = {
  tasks: TaskWithCategory[];
  updatedAt: number;
};

function isTaskShaped(value: unknown): value is TaskWithCategory {
  if (!value || typeof value !== "object") return false;

  const row = value as Record<string, unknown>;

  return typeof row.id === "string" && typeof row.title === "string";
}

function validatePersistedState(raw: unknown): TaskSnapshotState | null {
  if (!raw || typeof raw !== "object") return null;
  if (!canCacheErgonSnapshot(raw)) return null;

  const tasks = (raw as { tasks?: unknown }).tasks;

  if (!Array.isArray(tasks) || !tasks.every(isTaskShaped)) return null;

  return {
    tasks: tasks as TaskWithCategory[],
    updatedAt:
      typeof (raw as { updatedAt?: unknown }).updatedAt === "number"
        ? (raw as { updatedAt: number }).updatedAt
        : Date.now(),
  };
}

const store = createPersistentStore<TaskSnapshotState>(
  ERGON_TASK_SNAPSHOT_STORAGE_KEY,
  { tasks: [], updatedAt: 0 },
  { validate: validatePersistedState }
);

export function getCachedTasks(): TaskWithCategory[] {
  return store.getState().tasks;
}

export function setCachedTasks(tasks: TaskWithCategory[]): void {
  if (!canCacheErgonSnapshot({ tasks })) return;

  // Never persist optimistic temp rows — they are not server truth.
  const durable = tasks.filter((task) => !task.id.startsWith("temp-"));

  store.setState((prev) => ({ ...prev, tasks: durable, updatedAt: Date.now() }));
}

export function useCachedTasks(): TaskWithCategory[] {
  return store.useStore((state) => state.tasks);
}
