"use client";

import type { TaskWithCategory } from "@/lib/ergon/types";
import type { TaskInsert, TaskPatch } from "@/lib/schemas/tasks";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import {
  actionAddTask,
  actionDeleteTask,
  actionListTasks,
  actionToggleTaskComplete,
  actionUpdateTask,
} from "@/app/actions/tasks";
import { actionEnhanceTask } from "@/app/actions/ergon-enhance";
import { usePageVisible } from "@/components/hooks/use-page-visible";
import { summarizeEnhancement } from "@/lib/ergon/enhance-merge";
import { createTaskHistory } from "@/lib/ergon/task-history";
import { isBrowserOnline } from "@/lib/ergon/offline";
import { getCachedTasks, setCachedTasks } from "@/lib/ergon/task-snapshot-store";
import { taskToInsert } from "@/lib/ergon/task-to-insert";

function requireOnlineForWrite(): void {
  if (isBrowserOnline()) return;

  const message = "Need a connection to save changes";

  toast.error(message);
  throw new Error(message);
}

const PATCH_FIELD_KEYS: readonly string[] = [
  "title",
  "notes",
  "tags",
  "due_date",
  "priority",
  "status",
  "category_id",
  "planned_at",
  "planned_has_time",
  "est_minutes",
  "mental_effort",
  "is_active",
  "completed_at",
];

/** Capture the affected task's current values for the keys a patch touches (for undo). */
function previousPatchFor(before: TaskWithCategory, patch: TaskPatch): TaskPatch {
  const prev: Record<string, unknown> = {};
  const source = before as unknown as Record<string, unknown>;

  for (const key of Object.keys(patch)) {
    if (PATCH_FIELD_KEYS.includes(key)) prev[key] = source[key];
  }

  return prev as TaskPatch;
}

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
  const [tasks, setTasks] = useState<TaskWithCategory[]>(() => {
    if (initialTasks.length > 0) return initialTasks;

    return getCachedTasks();
  });
  const [syncing, setSyncing] = useState(false);
  const [, setHistoryVersion] = useState(0);
  const visible = usePageVisible();

  // Always-current snapshot so primitive mutations and undo/redo see the latest state.
  const tasksRef = useRef(tasks);

  tasksRef.current = tasks;

  const historyRef = useRef(createTaskHistory());
  const bump = useCallback(() => setHistoryVersion((v) => v + 1), []);

  const commitTasks = useCallback((next: TaskWithCategory[]) => {
    setTasks(next);
    setCachedTasks(next);
  }, []);

  const refresh = useCallback(async () => {
    if (!isBrowserOnline()) return;

    setSyncing(true);

    try {
      const next = (await actionListTasks()) as TaskWithCategory[];

      commitTasks(next);
    } catch (error) {
      // Keep the last snapshot when the network blips — do not wipe the board.
      if (tasksRef.current.length === 0) {
        toast.error(error instanceof Error ? error.message : "Failed to refresh tasks");
      }
    } finally {
      setSyncing(false);
    }
  }, [commitTasks]);

  useEffect(() => {
    if (initialTasks.length > 0) setCachedTasks(initialTasks);
  }, [initialTasks]);

  useEffect(() => {
    if (visible) void refresh();
  }, [refresh, visible]);

  // --- primitives (no history) -------------------------------------------------

  const _add = useCallback(async (input: TaskInsert): Promise<TaskWithCategory> => {
    requireOnlineForWrite();

    const tempId = `temp-${crypto.randomUUID()}`;
    const optimistic = buildOptimisticTask(input, tempId);

    setTasks((prev) => [optimistic, ...prev]);

    try {
      const row = (await actionAddTask(input)) as TaskWithCategory;

      setTasks((prev) => {
        const next = prev.map((task) => (task.id === tempId ? row : task));

        setCachedTasks(next);

        return next;
      });

      return row;
    } catch (error) {
      setTasks((prev) => prev.filter((task) => task.id !== tempId));
      toast.error(error instanceof Error ? error.message : "Failed to add task");
      throw error;
    }
  }, []);

  const _update = useCallback(
    async (id: string, patch: TaskPatch): Promise<TaskWithCategory | undefined> => {
      requireOnlineForWrite();

      const previous = tasksRef.current;

      setTasks((prev) =>
        prev.map((task) =>
          task.id === id ? { ...task, ...patch, updated_at: new Date().toISOString() } : task
        )
      );

      try {
        const row = (await actionUpdateTask(id, patch)) as TaskWithCategory;

        setTasks((prev) => {
          const next = prev.map((task) => (task.id === id ? row : task));

          setCachedTasks(next);

          return next;
        });

        return row;
      } catch (error) {
        setTasks(previous);
        toast.error(error instanceof Error ? error.message : "Failed to update task");
        throw error;
      }
    },
    []
  );

  const _remove = useCallback(async (id: string) => {
    requireOnlineForWrite();

    const previous = tasksRef.current;
    const optimistic = previous.filter((task) => task.id !== id);

    setTasks(optimistic);

    try {
      await actionDeleteTask(id);
      setCachedTasks(optimistic);
    } catch (error) {
      setTasks(previous);
      toast.error(error instanceof Error ? error.message : "Failed to delete task");
      throw error;
    }
  }, []);

  const _toggleComplete = useCallback(async (id: string) => {
    requireOnlineForWrite();

    const previous = tasksRef.current;
    const target = previous.find((task) => task.id === id);

    if (!target) return;

    const isDone = target.status === "done";

    setTasks((prev) =>
      prev.map((task) =>
        task.id === id
          ? {
              ...task,
              status: isDone ? "todo" : "done",
              completed_at: isDone ? null : new Date().toISOString(),
              updated_at: new Date().toISOString(),
            }
          : task
      )
    );

    try {
      const row = (await actionToggleTaskComplete(id)) as TaskWithCategory;

      setTasks((prev) => {
        const next = prev.map((task) => (task.id === id ? row : task));

        setCachedTasks(next);

        return next;
      });
    } catch (error) {
      setTasks(previous);
      toast.error(error instanceof Error ? error.message : "Failed to update task");
      throw error;
    }
  }, []);

  const _toggleActive = useCallback(async (id: string) => {
    requireOnlineForWrite();

    const previous = tasksRef.current;
    const target = previous.find((task) => task.id === id);

    if (!target) return;

    const nextActive = !target.is_active;
    const patch: TaskPatch = {
      is_active: nextActive,
      ...(nextActive &&
      target.status !== "doing" &&
      target.status !== "done" &&
      target.status !== "archived"
        ? { status: "doing" }
        : {}),
    };

    setTasks((prev) =>
      prev.map((task) =>
        task.id === id ? { ...task, ...patch, updated_at: new Date().toISOString() } : task
      )
    );

    try {
      const row = (await actionUpdateTask(id, patch)) as TaskWithCategory;

      setTasks((prev) => {
        const next = prev.map((task) => (task.id === id ? row : task));

        setCachedTasks(next);

        return next;
      });
    } catch (error) {
      setTasks(previous);
      toast.error(error instanceof Error ? error.message : "Failed to update task");
      throw error;
    }
  }, []);

  // --- history -----------------------------------------------------------------

  const record = useCallback(
    (command: Parameters<typeof historyRef.current.record>[0]) => {
      historyRef.current.record(command);
      bump();
    },
    [bump]
  );

  const undo = useCallback(async () => {
    try {
      await historyRef.current.undo();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't undo");
    } finally {
      bump();
    }
  }, [bump]);

  const redo = useCallback(async () => {
    try {
      await historyRef.current.redo();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't redo");
    } finally {
      bump();
    }
  }, [bump]);

  // --- public mutations (record undo/redo) -------------------------------------

  const addTask = useCallback(
    async (input: TaskInsert) => {
      const row = await _add(input);
      let id = row.id;

      record({
        undo: async () => {
          await _remove(id);
        },
        redo: async () => {
          const next = await _add(input);

          id = next.id;
        },
      });

      return row;
    },
    [_add, _remove, record]
  );

  const updateTask = useCallback(
    async (id: string, patch: TaskPatch) => {
      const before = tasksRef.current.find((task) => task.id === id);
      const prevPatch = before ? previousPatchFor(before, patch) : null;
      const row = await _update(id, patch);

      if (prevPatch) {
        record({
          undo: async () => {
            await _update(id, prevPatch);
          },
          redo: async () => {
            await _update(id, patch);
          },
        });
      }

      return row;
    },
    [_update, record]
  );

  const toggleComplete = useCallback(
    async (id: string) => {
      await _toggleComplete(id);
      record({ undo: () => _toggleComplete(id), redo: () => _toggleComplete(id) });
    },
    [_toggleComplete, record]
  );

  const toggleActive = useCallback(
    async (id: string) => {
      await _toggleActive(id);
      record({ undo: () => _toggleActive(id), redo: () => _toggleActive(id) });
    },
    [_toggleActive, record]
  );

  const deleteTask = useCallback(
    async (id: string) => {
      const snapshot = tasksRef.current.find((task) => task.id === id);

      if (!snapshot) return;

      await _remove(id);

      const insert = taskToInsert(snapshot);
      let currentId = id;

      record({
        undo: async () => {
          const next = await _add(insert);

          currentId = next.id;
        },
        redo: async () => {
          await _remove(currentId);
        },
      });
    },
    [_add, _remove, record]
  );

  const enhanceTask = useCallback(
    async (id: string) => {
      try {
        requireOnlineForWrite();
      } catch {
        return;
      }

      let patch;

      try {
        patch = await actionEnhanceTask(id);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Couldn't enhance task");

        return;
      }

      const filled = summarizeEnhancement(patch);

      if (filled.length === 0) {
        toast("Nothing to enhance", { description: "No empty fields to fill for this task." });

        return;
      }

      // Goes through updateTask so the change is optimistic, persisted, and undoable.
      await updateTask(id, patch);
      toast.success(`Enhanced · ${filled.join(", ")}`);
    },
    [updateTask]
  );

  const deleteTaskWithUndo = useCallback(
    async (id: string) => {
      const snapshot = tasksRef.current.find((task) => task.id === id);

      if (!snapshot) return;

      await _remove(id);

      const insert = taskToInsert(snapshot);
      let currentId = id;

      record({
        undo: async () => {
          const next = await _add(insert);

          currentId = next.id;
        },
        redo: async () => {
          await _remove(currentId);
        },
      });

      toast("Task deleted", {
        duration: 5000,
        action: { label: "Undo", onClick: () => void undo() },
      });
    },
    [_add, _remove, record, undo]
  );

  return {
    tasks,
    syncing,
    refresh,
    addTask,
    updateTask,
    toggleComplete,
    toggleActive,
    enhanceTask,
    deleteTask,
    deleteTaskWithUndo,
    undo,
    redo,
    canUndo: historyRef.current.canUndo(),
    canRedo: historyRef.current.canRedo(),
  };
}
