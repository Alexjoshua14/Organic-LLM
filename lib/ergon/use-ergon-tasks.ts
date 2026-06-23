"use client";

import type { TaskWithCategory } from "@/lib/ergon/types";
import type { TaskInsert, TaskPatch } from "@/lib/schemas/tasks";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import {
  actionAddTask,
  actionDeleteTask,
  actionListTasks,
  actionToggleTaskComplete,
  actionToggleTaskActive,
  actionUpdateTask,
} from "@/app/actions/tasks";
import { usePageVisible } from "@/components/hooks/use-page-visible";
import { taskToInsert } from "@/lib/ergon/task-to-insert";

function buildOptimisticTask(input: TaskInsert, tempId: string): TaskWithCategory {
  return {
    id: tempId,
    title: input.title,
    notes: input.notes ?? null,
    tags: input.tags ?? [],
    due_date: input.due_date ?? null,
    priority: input.priority ?? null,
    status: input.status ?? "todo",
    category_id: input.category_id ?? null,
    planned_at: input.planned_at ?? null,
    planned_has_time: input.planned_has_time ?? false,
    est_minutes: input.est_minutes ?? null,
    mental_effort: input.mental_effort ?? null,
    completed_at: null,
    is_active: input.is_active ?? false,
    owner_id: "",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    category: null,
  };
}

export function useErgonTasks(initialTasks: TaskWithCategory[]) {
  const [tasks, setTasks] = useState(initialTasks);
  const [syncing, setSyncing] = useState(false);
  const visible = usePageVisible();

  const refresh = useCallback(async () => {
    setSyncing(true);

    try {
      const next = (await actionListTasks()) as TaskWithCategory[];

      setTasks(next);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to refresh tasks");
    } finally {
      setSyncing(false);
    }
  }, []);

  useEffect(() => {
    if (visible) void refresh();
  }, [refresh, visible]);

  const addTask = useCallback(async (input: TaskInsert) => {
    const tempId = `temp-${crypto.randomUUID()}`;
    const optimistic = buildOptimisticTask(input, tempId);

    setTasks((prev) => [optimistic, ...prev]);

    try {
      const row = (await actionAddTask(input)) as TaskWithCategory;

      setTasks((prev) => prev.map((task) => (task.id === tempId ? row : task)));

      return row;
    } catch (error) {
      setTasks((prev) => prev.filter((task) => task.id !== tempId));
      toast.error(error instanceof Error ? error.message : "Failed to add task");
      throw error;
    }
  }, []);

  const updateTask = useCallback(
    async (id: string, patch: TaskPatch) => {
      const previous = tasks;
      const optimistic = tasks.map((task) =>
        task.id === id ? { ...task, ...patch, updated_at: new Date().toISOString() } : task
      );

      setTasks(optimistic);

      try {
        const row = (await actionUpdateTask(id, patch)) as TaskWithCategory;

        setTasks((prev) => prev.map((task) => (task.id === id ? row : task)));

        return row;
      } catch (error) {
        setTasks(previous);
        toast.error(error instanceof Error ? error.message : "Failed to update task");
        throw error;
      }
    },
    [tasks]
  );

  const toggleComplete = useCallback(
    async (id: string) => {
      const previous = tasks;
      const target = tasks.find((task) => task.id === id);

      if (!target) return;

      const isDone = target.status === "done";
      const optimistic = tasks.map((task) =>
        task.id === id
          ? {
              ...task,
              status: isDone ? "todo" : "done",
              completed_at: isDone ? null : new Date().toISOString(),
              updated_at: new Date().toISOString(),
            }
          : task
      );

      setTasks(optimistic);

      try {
        const row = (await actionToggleTaskComplete(id)) as TaskWithCategory;

        setTasks((prev) => prev.map((task) => (task.id === id ? row : task)));

        return row;
      } catch (error) {
        setTasks(previous);
        toast.error(error instanceof Error ? error.message : "Failed to update task");
        throw error;
      }
    },
    [tasks]
  );

  const toggleActive = useCallback(
    async (id: string) => {
      const previous = tasks;
      const target = tasks.find((task) => task.id === id);

      if (!target) return;

      const optimistic = tasks.map((task) =>
        task.id === id
          ? {
              ...task,
              is_active: !task.is_active,
              updated_at: new Date().toISOString(),
            }
          : task
      );

      setTasks(optimistic);

      try {
        const row = (await actionToggleTaskActive(id)) as TaskWithCategory;

        setTasks((prev) => prev.map((task) => (task.id === id ? row : task)));

        return row;
      } catch (error) {
        setTasks(previous);
        toast.error(error instanceof Error ? error.message : "Failed to update task");
        throw error;
      }
    },
    [tasks]
  );

  const deleteTask = useCallback(
    async (id: string) => {
      const previous = tasks;

      setTasks((prev) => prev.filter((task) => task.id !== id));

      try {
        await actionDeleteTask(id);
      } catch (error) {
        setTasks(previous);
        toast.error(error instanceof Error ? error.message : "Failed to delete task");
        throw error;
      }
    },
    [tasks]
  );

  const deleteTaskWithUndo = useCallback(
    async (id: string) => {
      const snapshot = tasks.find((task) => task.id === id);

      if (!snapshot) return;

      setTasks((prev) => prev.filter((task) => task.id !== id));

      try {
        await actionDeleteTask(id);

        toast("Task deleted", {
          duration: 5000,
          action: {
            label: "Undo",
            onClick: () => void addTask(taskToInsert(snapshot)),
          },
        });
      } catch (error) {
        setTasks((prev) => [snapshot, ...prev.filter((task) => task.id !== id)]);
        toast.error(error instanceof Error ? error.message : "Failed to delete task");
        throw error;
      }
    },
    [addTask, tasks]
  );

  return {
    tasks,
    syncing,
    refresh,
    addTask,
    updateTask,
    toggleComplete,
    toggleActive,
    deleteTask,
    deleteTaskWithUndo,
  };
}
