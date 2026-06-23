import { describe, expect, test } from "bun:test";

import { parsePastedTaskTitles } from "@/lib/ergon/parse-paste";
import {
  PLAN_BUCKET_ORDER,
  getPlanBucket,
  groupTasksByPlanBucket,
  sumEstMinutes,
} from "@/lib/ergon/plan-buckets";
import { DEFAULT_ERGON_FILTERS, type TaskWithCategory } from "@/lib/ergon/types";
import { filterTasks, groupTasksByCategory, isErgonFiltersActive, isOpenTask } from "@/lib/ergon/task-view";

function task(partial: Partial<TaskWithCategory> & Pick<TaskWithCategory, "id" | "title">): TaskWithCategory {
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

describe("plan-buckets", () => {
  const now = new Date("2026-06-22T15:00:00");

  test("maps planned dates into buckets", () => {
    expect(getPlanBucket(null, now)).toBe("unscheduled");
    expect(getPlanBucket("2026-06-22T10:00:00.000Z", now)).toBe("today");
    expect(getPlanBucket("2026-06-23T10:00:00.000Z", now)).toBe("tomorrow");
    expect(getPlanBucket("2026-06-25T10:00:00.000Z", now)).toBe("this_week");
    expect(getPlanBucket("2026-07-01T10:00:00.000Z", now)).toBe("later");
  });

  test("groups tasks and sums capacity", () => {
    const buckets = groupTasksByPlanBucket(
      [
        task({ id: "1", title: "Today", planned_at: "2026-06-22T10:00:00.000Z", est_minutes: 30 }),
        task({ id: "2", title: "Later", planned_at: "2026-07-01T10:00:00.000Z", est_minutes: 15 }),
      ],
      now
    );

    expect(buckets.today).toHaveLength(1);
    expect(buckets.later).toHaveLength(1);
    expect(sumEstMinutes(buckets.today)).toBe(30);
    expect(PLAN_BUCKET_ORDER).toContain("unscheduled");
  });
});

describe("task-view", () => {
  test("filters by search and open status helpers", () => {
    const tasks = [
      task({ id: "1", title: "Write spec", notes: "docs" }),
      task({ id: "2", title: "Ship code", status: "done" }),
    ];

    expect(isOpenTask("todo")).toBe(true);
    expect(
      filterTasks(tasks, { ...DEFAULT_ERGON_FILTERS, search: "spec" })
    ).toHaveLength(1);
  });

  test("groups by category", () => {
    const groups = groupTasksByCategory(
      [
        task({ id: "1", title: "A", category_id: "cat-1" }),
        task({ id: "2", title: "B", category_id: null }),
      ],
      [
        {
          id: "cat-1",
          name: "Work",
          color: "#000",
          icon: null,
          sort_order: 0,
          owner_id: "o",
          created_at: "",
          updated_at: "",
        },
      ]
    );

    expect(groups).toHaveLength(2);
    expect(groups[0]?.label).toBe("Work");
  });

  test("detects active filters", () => {
    expect(isErgonFiltersActive(DEFAULT_ERGON_FILTERS)).toBe(false);
    expect(isErgonFiltersActive({ ...DEFAULT_ERGON_FILTERS, search: "spec" })).toBe(true);
  });
});

describe("parse-paste", () => {
  test("parses markdown checklist paste", () => {
    const pasted = `- [ ] Create Todo MVP in Organic LLM
- [ ] Get Dad's father day gift
- [ ] hang up shelf in closet
- [ ] plan where to put light strip
- [ ] Buy light strip / back light for peg board
- [ ] clean up desk cables`;

    expect(parsePastedTaskTitles(pasted)).toEqual([
      "Create Todo MVP in Organic LLM",
      "Get Dad's father day gift",
      "hang up shelf in closet",
      "plan where to put light strip",
      "Buy light strip / back light for peg board",
      "clean up desk cables",
    ]);
  });

  test("parses plain multi-line paste", () => {
    expect(parsePastedTaskTitles("Buy milk\nCall dentist")).toEqual(["Buy milk", "Call dentist"]);
  });
});
