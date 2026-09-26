import { describe, expect, test } from "bun:test";

import {
  REMY_WEEK_GRID_MIN_WIDTH_PX,
  remyUsesWeekGrid,
} from "@/lib/remy/remy-layout";

describe("remyUsesWeekGrid", () => {
  test("rejects non-positive and non-finite widths", () => {
    expect(remyUsesWeekGrid(0)).toBe(false);
    expect(remyUsesWeekGrid(-1)).toBe(false);
    expect(remyUsesWeekGrid(Number.NaN)).toBe(false);
    expect(remyUsesWeekGrid(Number.POSITIVE_INFINITY)).toBe(false);
  });

  test("stacks below the desktop grid threshold", () => {
    expect(remyUsesWeekGrid(390)).toBe(false);
    expect(remyUsesWeekGrid(844)).toBe(false);
    expect(remyUsesWeekGrid(REMY_WEEK_GRID_MIN_WIDTH_PX - 1)).toBe(false);
  });

  test("uses the 7-day grid at and above the threshold", () => {
    expect(remyUsesWeekGrid(REMY_WEEK_GRID_MIN_WIDTH_PX)).toBe(true);
    expect(remyUsesWeekGrid(1280)).toBe(true);
  });

  test("threshold matches Tailwind lg (1024)", () => {
    expect(REMY_WEEK_GRID_MIN_WIDTH_PX).toBe(1024);
  });
});
