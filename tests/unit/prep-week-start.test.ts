import { describe, expect, test } from "bun:test";

import {
  dateIsInWeek,
  formatWeekRange,
  isMonday,
  mondayOf,
  resolveWeekStart,
  shiftWeek,
  weekDates,
} from "@/lib/prep/week-start";

describe("mondayOf / weekDates", () => {
  test("pins any day in the week to that Monday", () => {
    expect(mondayOf("2026-08-14")).toBe("2026-08-10");
    expect(mondayOf("2026-08-10")).toBe("2026-08-10");
    expect(mondayOf("2026-08-16")).toBe("2026-08-10");
    expect(isMonday("2026-08-10")).toBe(true);
    expect(isMonday("2026-08-11")).toBe(false);
  });

  test("returns seven dates Monday through Sunday", () => {
    expect(weekDates("2026-08-10")).toEqual([
      "2026-08-10",
      "2026-08-11",
      "2026-08-12",
      "2026-08-13",
      "2026-08-14",
      "2026-08-15",
      "2026-08-16",
    ]);
    expect(dateIsInWeek("2026-08-14", "2026-08-10")).toBe(true);
    expect(dateIsInWeek("2026-08-17", "2026-08-10")).toBe(false);
  });

  test("shiftWeek moves by seven days and stays on Monday", () => {
    expect(shiftWeek("2026-08-10", 1)).toBe("2026-08-17");
    expect(shiftWeek("2026-08-10", -1)).toBe("2026-08-03");
  });

  test("resolveWeekStart pins query dates to Monday and falls back", () => {
    expect(resolveWeekStart("2026-08-14", "2026-08-14")).toBe("2026-08-10");
    expect(resolveWeekStart(undefined, "2026-08-14")).toBe("2026-08-10");
    expect(resolveWeekStart("nope", "2026-08-14")).toBe("2026-08-10");
  });

  test("formatWeekRange uses the Mon–Sun span", () => {
    expect(formatWeekRange("2026-08-10")).toBe("Aug 10–16, 2026");
  });
});
