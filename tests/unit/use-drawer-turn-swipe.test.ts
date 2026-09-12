import { describe, expect, test } from "bun:test";

import { MIN_DY } from "@/hooks/use-drawer-turn-swipe";

// Hook is gesture-driven; test exported thresholds/constants via module behavior smoke.

describe("useDrawerTurnSwipe thresholds", () => {
  test("minimum vertical distance matches article swipe constant", () => {
    expect(MIN_DY).toBe(56);
  });
});
