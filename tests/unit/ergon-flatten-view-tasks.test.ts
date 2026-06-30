import { describe, expect, test } from "bun:test";

import {
  flattenDoneViewTaskIds,
  flattenListViewTaskIds,
  flattenPlanViewTaskIds,
} from "@/lib/ergon/flatten-view-tasks";
import type { TaskCategoryRow, TaskWithCategory } from "@/lib/ergon/types";

function task(
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

function category(id: string, name: string): TaskCategoryRow {
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

describe("flattenPlanViewTaskIds", () => {
  test("orders ids by plan bucket (today before later before unscheduled)", () => {
    const now = new Date();
    const todayIso = now.toISOString();
    const laterIso = new Date(now.getTime() + 30 * 86400000).toISOString();

    const ids = flattenPlanViewTaskIds([
      task({ id: "later", title: "Later", planned_at: laterIso }),
      task({ id: "unscheduled", title: "Someday" }),
      task({ id: "today", title: "Today", planned_at: todayIso }),
    ]);

    expect(ids).toEqual(["today", "later", "unscheduled"]);
  });
});

describe("flattenListViewTaskIds", () => {
  test("orders ids by category group", () => {
    const ids = flattenListViewTaskIds(
      [
        task({ id: "b", title: "B", category_id: null }),
        task({ id: "a", title: "A", category_id: "work" }),
      ],
      [category("work", "Work")]
    );

    expect(ids).toEqual(["a", "b"]);
  });
});

describe("flattenDoneViewTaskIds", () => {
  test("orders ids by most recent completion", () => {
    const ids = flattenDoneViewTaskIds([
      task({ id: "old", title: "Old", status: "done", completed_at: "2026-01-01T00:00:00.000Z" }),
      task({ id: "new", title: "New", status: "done", completed_at: "2026-02-01T00:00:00.000Z" }),
    ]);

    expect(ids).toEqual(["new", "old"]);
  });
});
