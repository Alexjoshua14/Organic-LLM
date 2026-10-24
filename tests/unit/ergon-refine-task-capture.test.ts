import { describe, expect, test } from "bun:test";

import { mergeRefinedTaskCaptures } from "@/lib/ergon/refine-task-capture-merge";
import {
  needsLlmRefinement,
  refineTasksLocally,
  sentenceCaseTitle,
  titleHasMetadataSignals,
} from "@/lib/ergon/refine-task-capture-local";

describe("refine-task-capture-local", () => {
  test("sentence-cases lowercase-leading titles", () => {
    expect(sentenceCaseTitle("hang up shelf in closet")).toBe("Hang up shelf in closet");
    expect(sentenceCaseTitle("Buy light strip")).toBe("Buy light strip");
    expect(sentenceCaseTitle("Create Todo MVP in Organic LLM")).toBe("Create Todo MVP in Organic LLM");
  });

  test("refines checklist paste locally without LLM", () => {
    const pasted = `- [ ] Create Todo MVP in Organic LLM
- [ ] Get Dad's father day gift
- [ ] hang up shelf in closet
- [ ] plan where to put light strip
- [ ] Buy light strip / back light for peg board
- [ ] clean up desk cables`;

    const titles = pasted
      .split("\n")
      .map((line) => line.replace(/^- \[ \]\s*/, "").trim());

    expect(needsLlmRefinement(titles)).toBe(false);
    expect(refineTasksLocally(titles).map((task) => task.title)).toEqual([
      "Create Todo MVP in Organic LLM",
      "Get Dad's father day gift",
      "Hang up shelf in closet",
      "Plan where to put light strip",
      "Buy light strip / back light for peg board",
      "Clean up desk cables",
    ]);
  });

  test("detects metadata signals for optional LLM pass", () => {
    expect(titleHasMetadataSignals("Call dentist tomorrow ~30 min, low effort")).toBe(true);
    expect(titleHasMetadataSignals("Hang up shelf")).toBe(false);
  });
});

describe("refine-task-capture-merge", () => {
  test("drops LLM fields not grounded in source title", () => {
    const merged = mergeRefinedTaskCaptures(
      ["Hang up shelf in closet"],
      [
        {
          title: "Hang up shelf in closet",
          category_name: "Home",
          priority: "urgent",
          est_minutes: 30,
        },
      ],
      [{ id: "11111111-1111-4111-8111-111111111111", name: "Home" }]
    );

    expect(merged[0]).toEqual({
      title: "Hang up shelf in closet",
      tags: [],
    });
  });

  test("keeps grounded metadata from LLM output", () => {
    const merged = mergeRefinedTaskCaptures(
      ["Urgent: book dentist tomorrow (~30 min, low effort)"],
      [
        {
          title: "Urgent: book dentist tomorrow (~30 min, low effort)",
          priority: "urgent",
          planned_date: "2026-06-23",
          est_minutes: 30,
          mental_effort: "low",
        },
      ],
      []
    );

    expect(merged[0]?.priority).toBe("urgent");
    expect(merged[0]?.est_minutes).toBe(30);
    expect(merged[0]?.mental_effort).toBe("low");
    expect(merged[0]?.planned_at).toBe("2026-06-23T12:00:00.000Z");
  });
});
