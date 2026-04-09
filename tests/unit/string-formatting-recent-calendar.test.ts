import { describe, expect, test } from "bun:test";

import {
  formatRecentCalendarDate,
  sameLocalCalendarDay,
} from "@/lib/format/stringFormatting";

const LOCALE = "en-US";

/** Local wall-clock instant (month 1–12). */
function local(y: number, month: number, day: number, h = 12, minute = 0): Date {
  return new Date(y, month - 1, day, h, minute, 0, 0);
}

/**
 * ISO-like string without timezone; ES parses as local time (same as `local()` in the runner TZ).
 */
function localIso(y: number, month: number, day: number, h = 12, minute = 0): string {
  const d = local(y, month, day, h, minute);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:00`;
}

describe("sameLocalCalendarDay", () => {
  test("returns true for same local calendar day at different times", () => {
    const a = local(2026, 4, 8, 0, 5);
    const b = local(2026, 4, 8, 23, 59);
    expect(sameLocalCalendarDay(a, b)).toBe(true);
  });

  test("returns false across midnight boundary", () => {
    const late = local(2026, 4, 8, 23, 59);
    const early = local(2026, 4, 9, 0, 1);
    expect(sameLocalCalendarDay(late, early)).toBe(false);
  });

  test("distinguishes leap-day from March 1 in a leap year", () => {
    const feb29 = local(2024, 2, 29, 12, 0);
    const mar1 = local(2024, 3, 1, 12, 0);
    expect(sameLocalCalendarDay(feb29, mar1)).toBe(false);
  });
});

describe("formatRecentCalendarDate", () => {
  test("same local calendar day → today at time (en-US)", () => {
    const now = local(2026, 4, 8, 15, 0);
    const updated = localIso(2026, 4, 8, 9, 15);
    expect(formatRecentCalendarDate(updated, { now, locale: LOCALE })).toBe("today at 9:15 AM");
  });

  test("previous local calendar day → yesterday at time", () => {
    const now = local(2026, 4, 8, 10, 0);
    const updated = localIso(2026, 4, 7, 18, 45);
    expect(formatRecentCalendarDate(updated, { now, locale: LOCALE })).toBe("yesterday at 6:45 PM");
  });

  test("older date → Month Day, Year without time", () => {
    const now = local(2026, 4, 8, 12, 0);
    const updated = localIso(2026, 4, 5, 3, 30);
    expect(formatRecentCalendarDate(updated, { now, locale: LOCALE })).toBe("April 5, 2026");
  });

  test("January 1st formats as long date when not today or yesterday", () => {
    const now = local(2026, 3, 15, 12, 0);
    const updated = localIso(2026, 1, 1, 8, 0);
    expect(formatRecentCalendarDate(updated, { now, locale: LOCALE })).toBe("January 1, 2026");
  });

  test("first of month crossing month boundary: yesterday from April 1 is March 31", () => {
    const now = local(2026, 4, 1, 9, 0);
    const updated = localIso(2026, 3, 31, 22, 0);
    expect(formatRecentCalendarDate(updated, { now, locale: LOCALE })).toBe("yesterday at 10:00 PM");
  });

  test("year boundary: Dec 31 is yesterday when now is Jan 1", () => {
    const now = local(2026, 1, 1, 11, 0);
    const updated = localIso(2025, 12, 31, 20, 0);
    expect(formatRecentCalendarDate(updated, { now, locale: LOCALE })).toBe("yesterday at 8:00 PM");
  });

  test("leap year: Feb 29, 2024 formats as long date when now is later in March", () => {
    const now = local(2024, 3, 15, 12, 0);
    const updated = localIso(2024, 2, 29, 14, 0);
    expect(formatRecentCalendarDate(updated, { now, locale: LOCALE })).toBe("February 29, 2024");
  });

  test("leap year: Mar 1 with updated Feb 29 is yesterday (2024)", () => {
    const now = local(2024, 3, 1, 8, 0);
    const updated = localIso(2024, 2, 29, 16, 30);
    expect(formatRecentCalendarDate(updated, { now, locale: LOCALE })).toBe("yesterday at 4:30 PM");
  });

  test("non–leap year: Feb 28 is yesterday when now is Mar 1", () => {
    const now = local(2023, 3, 1, 8, 0);
    const updated = localIso(2023, 2, 28, 12, 0);
    expect(formatRecentCalendarDate(updated, { now, locale: LOCALE })).toBe("yesterday at 12:00 PM");
  });

  test("midnight local time still counts as today when now is same calendar day", () => {
    const now = local(2026, 6, 1, 23, 0);
    const updated = localIso(2026, 6, 1, 0, 0);
    expect(formatRecentCalendarDate(updated, { now, locale: LOCALE })).toBe("today at 12:00 AM");
  });

  test("noon boundary: late evening yesterday vs early morning today", () => {
    const now = local(2026, 7, 10, 1, 0);
    const updated = localIso(2026, 7, 9, 23, 59);
    expect(formatRecentCalendarDate(updated, { now, locale: LOCALE })).toBe("yesterday at 11:59 PM");
  });
});
