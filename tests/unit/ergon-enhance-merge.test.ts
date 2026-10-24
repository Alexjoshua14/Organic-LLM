import { describe, expect, test } from "bun:test";

import { mergeEnhancement, summarizeEnhancement } from "@/lib/ergon/enhance-merge";
import type { ErgonEnhanceFields } from "@/lib/schemas/ergon-enhance";

const categories = [
  { id: "cat-home", name: "Home Improvements" },
  { id: "cat-work", name: "Work" },
];

const emptyTask = {
  category_id: null,
  priority: null,
  due_date: null,
  planned_at: null,
  est_minutes: null,
  mental_effort: null,
};

const fullSuggestion: ErgonEnhanceFields = {
  category_name: "Home Improvements",
  priority: "medium",
  due_date: "2026-06-30",
  planned_date: "2026-06-23",
  est_minutes: 30,
  mental_effort: "low",
};

describe("mergeEnhancement", () => {
  test("fills only empty fields on a sparse task", () => {
    const patch = mergeEnhancement(emptyTask, fullSuggestion, categories);

    expect(patch).toEqual({
      category_id: "cat-home",
      priority: "medium",
      due_date: "2026-06-30",
      planned_at: "2026-06-23T12:00:00.000Z",
      planned_has_time: false,
      est_minutes: 30,
      mental_effort: "low",
    });
  });

  test("never overwrites existing values", () => {
    const patch = mergeEnhancement(
      {
        category_id: "cat-work",
        priority: "high",
        due_date: "2026-07-01",
        planned_at: "2026-07-02T12:00:00.000Z",
        est_minutes: 60,
        mental_effort: "high",
      },
      fullSuggestion,
      categories
    );

    expect(patch).toEqual({});
  });

  test("ignores unknown category names", () => {
    const patch = mergeEnhancement(
      emptyTask,
      { ...fullSuggestion, category_name: "Invented Category" },
      categories
    );

    expect(patch.category_id).toBeUndefined();
    expect(patch.priority).toBe("medium");
  });

  test("matches category names case-insensitively", () => {
    const patch = mergeEnhancement(
      emptyTask,
      { category_name: "  home improvements  " },
      categories
    );

    expect(patch.category_id).toBe("cat-home");
  });

  test("skips blank category_name strings", () => {
    const patch = mergeEnhancement(emptyTask, { category_name: "   " }, categories);

    expect(patch.category_id).toBeUndefined();
  });

  test("rejects invalid priority and mental_effort values", () => {
    const patch = mergeEnhancement(
      emptyTask,
      {
        priority: "critical" as ErgonEnhanceFields["priority"],
        mental_effort: "extreme" as ErgonEnhanceFields["mental_effort"],
      },
      categories
    );

    expect(patch.priority).toBeUndefined();
    expect(patch.mental_effort).toBeUndefined();
  });

  test("ignores est_minutes below 1 or null", () => {
    expect(mergeEnhancement(emptyTask, { est_minutes: 0 }, categories).est_minutes).toBeUndefined();
    expect(mergeEnhancement(emptyTask, { est_minutes: null }, categories).est_minutes).toBeUndefined();
  });

  test("does not set planned_has_time when planned_at already exists", () => {
    const patch = mergeEnhancement(
      { ...emptyTask, planned_at: "2026-01-01T12:00:00.000Z" },
      { planned_date: "2026-06-23" },
      categories
    );

    expect(patch.planned_at).toBeUndefined();
    expect(patch.planned_has_time).toBeUndefined();
  });

  test("partially fills when only some fields are empty", () => {
    const patch = mergeEnhancement(
      {
        ...emptyTask,
        priority: "low",
        est_minutes: 15,
      },
      fullSuggestion,
      categories
    );

    expect(patch).toEqual({
      category_id: "cat-home",
      due_date: "2026-06-30",
      planned_at: "2026-06-23T12:00:00.000Z",
      planned_has_time: false,
      mental_effort: "low",
    });
    expect(patch.priority).toBeUndefined();
    expect(patch.est_minutes).toBeUndefined();
  });
});

describe("summarizeEnhancement", () => {
  test("maps patch keys to human-readable labels", () => {
    const labels = summarizeEnhancement({
      category_id: "cat-home",
      priority: "medium",
      est_minutes: 30,
      mental_effort: "low",
      planned_at: "2026-06-23T12:00:00.000Z",
      planned_has_time: false,
      due_date: "2026-06-30",
    });

    expect(labels).toEqual([
      "category",
      "priority",
      "duration",
      "effort",
      "planned date",
      "due date",
    ]);
  });

  test("ignores unknown patch keys", () => {
    const labels = summarizeEnhancement({
      title: "Updated title",
      category_id: "cat-work",
    } as Parameters<typeof summarizeEnhancement>[0]);

    expect(labels).toEqual(["category"]);
  });

  test("returns an empty array for an empty patch", () => {
    expect(summarizeEnhancement({})).toEqual([]);
  });
});
