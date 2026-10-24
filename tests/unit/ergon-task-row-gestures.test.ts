import { describe, expect, test } from "bun:test";

import {
  ERGON_SWIPE_ACTIVE_RATIO,
  ERGON_SWIPE_COMPLETE_RATIO,
  ERGON_SWIPE_DELETE_RATIO,
  clampSwipeOffset,
  getSwipePreview,
  isScrollDominant,
  resolveSwipeAction,
} from "@/lib/ergon/task-row-gestures";

const WIDTH = 300;

describe("resolveSwipeAction", () => {
  test("right short swipe completes", () => {
    expect(resolveSwipeAction(WIDTH * (ERGON_SWIPE_COMPLETE_RATIO + 0.05), WIDTH)).toBe("complete");
  });

  test("right long swipe toggles active (long wins over short)", () => {
    expect(resolveSwipeAction(WIDTH * (ERGON_SWIPE_ACTIVE_RATIO + 0.05), WIDTH)).toBe("active");
  });

  test("exact active threshold resolves to active not complete", () => {
    expect(resolveSwipeAction(WIDTH * ERGON_SWIPE_ACTIVE_RATIO, WIDTH)).toBe("active");
  });

  test("left long swipe deletes", () => {
    expect(resolveSwipeAction(-WIDTH * (ERGON_SWIPE_DELETE_RATIO + 0.05), WIDTH)).toBe("delete");
  });

  test("short left swipe is a no-op (snap back)", () => {
    expect(resolveSwipeAction(-WIDTH * 0.2, WIDTH)).toBeNull();
  });

  test("tiny right movement is a no-op", () => {
    expect(resolveSwipeAction(WIDTH * 0.05, WIDTH)).toBeNull();
  });

  test("zero row width never resolves", () => {
    expect(resolveSwipeAction(500, 0)).toBeNull();
  });
});

describe("getSwipePreview", () => {
  test("previews complete then active as the drag grows", () => {
    expect(getSwipePreview(WIDTH * 0.1, WIDTH)).toBeNull();
    expect(getSwipePreview(WIDTH * ERGON_SWIPE_COMPLETE_RATIO, WIDTH)).toBe("complete");
    expect(getSwipePreview(WIDTH * ERGON_SWIPE_ACTIVE_RATIO, WIDTH)).toBe("active");
  });

  test("previews delete on a long left drag", () => {
    expect(getSwipePreview(-WIDTH * 0.2, WIDTH)).toBeNull();
    expect(getSwipePreview(-WIDTH * ERGON_SWIPE_DELETE_RATIO, WIDTH)).toBe("delete");
  });
});

describe("isScrollDominant", () => {
  test("vertical-dominant gesture is a scroll", () => {
    expect(isScrollDominant(10, 40)).toBe(true);
  });

  test("horizontal-dominant gesture is a swipe", () => {
    expect(isScrollDominant(40, 10)).toBe(false);
  });

  test("small movement defers to the larger axis", () => {
    expect(isScrollDominant(3, 5)).toBe(true);
    expect(isScrollDominant(5, 3)).toBe(false);
  });
});

describe("clampSwipeOffset", () => {
  test("clamps to 65% of row width in both directions", () => {
    expect(clampSwipeOffset(1000, WIDTH)).toBeCloseTo(WIDTH * 0.65);
    expect(clampSwipeOffset(-1000, WIDTH)).toBeCloseTo(-WIDTH * 0.65);
  });

  test("passes small offsets through unchanged", () => {
    expect(clampSwipeOffset(40, WIDTH)).toBe(40);
  });
});
