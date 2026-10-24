import { describe, expect, test } from "bun:test";

import { executeManageTasks, type ManageTasksDeps } from "@/lib/llm/ergon-tasks-execute";
import type { TaskCategoryRow, TaskWithCategory } from "@/lib/ergon/types";

function makeTask(
  partial: Partial<TaskWithCategory> & Pick<TaskWithCategory, "id" | "title">
): TaskWithCategory {
  return {
    id: partial.id,
    title: partial.title,
    notes: partial.notes ?? null,
    tags: partial.tags ?? [],
    due_date: partial.due_date ?? null,
    priority: partial.priority ?? null,
    status: partial.status ?? "todo",
    category_id: partial.category_id ?? null,
    planned_at: partial.planned_at ?? null,
    planned_has_time: partial.planned_has_time ?? false,
    est_minutes: partial.est_minutes ?? null,
    mental_effort: partial.mental_effort ?? null,
    completed_at: partial.completed_at ?? null,
    is_active: partial.is_active ?? false,
    owner_id: "owner",
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    category: partial.category ?? null,
  };
}

function makeCategoryRow(id: string, name: string): TaskCategoryRow {
  return {
    id,
    name,
    color: "#128C74",
    icon: null,
    sort_order: 0,
    owner_id: "owner",
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
  };
}

function makeDeps(seed: TaskWithCategory[] = []) {
  const store = new Map(seed.map((t) => [t.id, t]));
  const categoriesById = new Map<string, TaskCategoryRow>();
  const categoriesByName = new Map<string, TaskCategoryRow>();
  let taskCounter = 0;
  let categoryCounter = 0;

  const deps: ManageTasksDeps = {
    createTask: async (input) => {
      const id = `task-${++taskCounter}`;
      const category = input.category_id ? (categoriesById.get(input.category_id) ?? null) : null;
      const row = makeTask({
        id,
        title: input.title,
        notes: input.notes ?? null,
        priority: input.priority ?? null,
        due_date: input.due_date ?? null,
        planned_at: input.planned_at ?? null,
        planned_has_time: input.planned_has_time ?? false,
        est_minutes: input.est_minutes ?? null,
        mental_effort: input.mental_effort ?? null,
        category_id: input.category_id ?? null,
        category,
      });

      store.set(id, row);

      return row;
    },
    updateTask: async (id, patch) => {
      const current = store.get(id);

      if (!current) throw new Error("Task not found");

      const category = patch.category_id
        ? (categoriesById.get(patch.category_id) ?? current.category)
        : current.category;
      const next = { ...current, ...patch, category } as TaskWithCategory;

      store.set(id, next);

      return next;
    },
    completeTask: async (id) => {
      const current = store.get(id);

      if (!current) throw new Error("Task not found");

      const next = { ...current, status: "done", completed_at: "2026-06-22T00:00:00.000Z" };

      store.set(id, next);

      return next;
    },
    listTasks: async () => Array.from(store.values()),
    resolveOrCreateCategoryByName: async (name) => {
      const key = name.trim().toLowerCase();
      const existing = categoriesByName.get(key);

      if (existing) return existing;

      const created = makeCategoryRow(`cat-${++categoryCounter}`, name.trim());

      categoriesById.set(created.id, created);
      categoriesByName.set(key, created);

      return created;
    },
  };

  return { deps, store, categoriesByName };
}

describe("executeManageTasks · CREATE_TASKS", () => {
  test("creates tasks, resolves category by name, maps planned_date to a timestamp", async () => {
    const { deps } = makeDeps();

    const result = await executeManageTasks(
      {
        command: "CREATE_TASKS",
        tasks: [
          {
            title: "Book dentist",
            category_name: "Health",
            priority: "high",
            planned_date: "2026-06-23",
            est_minutes: 30,
          },
        ],
      },
      deps
    );

    expect(result.action).toBe("created");
    expect(result.count).toBe(1);
    expect(result.tasks[0]?.title).toBe("Book dentist");
    expect(result.tasks[0]?.category_name).toBe("Health");
    expect(result.tasks[0]?.priority).toBe("high");
    expect(result.tasks[0]?.planned_at).toBe("2026-06-23T12:00:00.000Z");
  });

  test("does not set fields the model did not provide (no invention)", async () => {
    const { deps } = makeDeps();

    const result = await executeManageTasks(
      { command: "CREATE_TASKS", tasks: [{ title: "Hang shelf" }] },
      deps
    );

    expect(result.tasks[0]?.priority).toBeNull();
    expect(result.tasks[0]?.due_date).toBeNull();
    expect(result.tasks[0]?.planned_at).toBeNull();
    expect(result.tasks[0]?.category_name).toBeNull();
  });

  test("reuses an existing category case-insensitively", async () => {
    const { deps, categoriesByName } = makeDeps();

    await executeManageTasks(
      { command: "CREATE_TASKS", tasks: [{ title: "A", category_name: "Work" }] },
      deps
    );
    await executeManageTasks(
      { command: "CREATE_TASKS", tasks: [{ title: "B", category_name: "work" }] },
      deps
    );

    expect(categoriesByName.size).toBe(1);
  });

  test("returns an error result when tasks are missing", async () => {
    const { deps } = makeDeps();

    const result = await executeManageTasks({ command: "CREATE_TASKS", tasks: undefined }, deps);

    expect(result.action).toBe("error");
    expect(result.tasks).toHaveLength(0);
  });
});

describe("executeManageTasks · UPDATE_TASK", () => {
  test("applies a patch to an existing task", async () => {
    const { deps } = makeDeps([makeTask({ id: "t1", title: "Old" })]);

    const result = await executeManageTasks(
      { command: "UPDATE_TASK", task_id: "t1", patch: { title: "New", priority: "urgent" } },
      deps
    );

    expect(result.action).toBe("updated");
    expect(result.tasks[0]?.title).toBe("New");
    expect(result.tasks[0]?.priority).toBe("urgent");
  });

  test("errors when task_id is missing", async () => {
    const { deps } = makeDeps();

    const result = await executeManageTasks({ command: "UPDATE_TASK", patch: { title: "X" } }, deps);

    expect(result.action).toBe("error");
    expect(result.error).toContain("task_id");
  });
});

describe("executeManageTasks · COMPLETE_TASK", () => {
  test("marks a task done", async () => {
    const { deps } = makeDeps([makeTask({ id: "t1", title: "Do it" })]);

    const result = await executeManageTasks({ command: "COMPLETE_TASK", task_id: "t1" }, deps);

    expect(result.action).toBe("completed");
    expect(result.tasks[0]?.status).toBe("done");
  });

  test("errors when task_id is missing", async () => {
    const { deps } = makeDeps();

    const result = await executeManageTasks({ command: "COMPLETE_TASK" }, deps);

    expect(result.action).toBe("error");
  });
});

describe("executeManageTasks · LIST_TASKS", () => {
  const seed = [
    makeTask({ id: "t1", title: "Write spec", status: "todo" }),
    makeTask({ id: "t2", title: "Ship code", status: "done" }),
    makeTask({
      id: "t3",
      title: "Email team",
      status: "todo",
      category: makeCategoryRow("cat-1", "Work"),
      category_id: "cat-1",
    }),
  ];

  test("lists all tasks when unfiltered", async () => {
    const { deps } = makeDeps(seed);

    const result = await executeManageTasks({ command: "LIST_TASKS" }, deps);

    expect(result.action).toBe("listed");
    expect(result.count).toBe(3);
  });

  test("filters by status", async () => {
    const { deps } = makeDeps(seed);

    const result = await executeManageTasks(
      { command: "LIST_TASKS", filter: { status: "todo" } },
      deps
    );

    expect(result.tasks.map((t) => t.id).sort()).toEqual(["t1", "t3"]);
  });

  test("filters by search and category name", async () => {
    const { deps } = makeDeps(seed);

    const bySearch = await executeManageTasks(
      { command: "LIST_TASKS", filter: { search: "spec" } },
      deps
    );

    expect(bySearch.tasks.map((t) => t.id)).toEqual(["t1"]);

    const byCategory = await executeManageTasks(
      { command: "LIST_TASKS", filter: { category_name: "work" } },
      deps
    );

    expect(byCategory.tasks.map((t) => t.id)).toEqual(["t3"]);
  });
});
