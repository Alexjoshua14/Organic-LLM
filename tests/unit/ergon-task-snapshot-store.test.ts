import type { TaskWithCategory } from "@/lib/ergon/types";

import { afterEach, describe, expect, test } from "bun:test";

import { getCachedTasks, setCachedTasks } from "@/lib/ergon/task-snapshot-store";

const sample = {
  id: "task-1",
  title: "Read docs",
  notes: null,
  tags: [],
  due_date: null,
  priority: null,
  status: "todo",
  category_id: null,
  planned_at: null,
  planned_has_time: false,
  est_minutes: null,
  mental_effort: null,
  completed_at: null,
  is_active: false,
  owner_id: "profile-1",
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
  category: null,
} as TaskWithCategory;

afterEach(() => {
  setCachedTasks([]);
});

describe("ergon task snapshot store", () => {
  test("stores durable tasks and drops optimistic temp rows", () => {
    setCachedTasks([sample, { ...sample, id: "temp-abc", title: "Optimistic" }]);

    expect(getCachedTasks()).toEqual([sample]);
  });

  test("refuses to persist a payload that smuggles a token field", () => {
    setCachedTasks([]);
    // Bypass the typed API shape to assert the guard — cast through unknown.
    setCachedTasks([{ ...sample, access_token: "nope" } as unknown as TaskWithCategory]);

    expect(getCachedTasks()).toEqual([]);
  });
});
