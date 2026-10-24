import { describe, expect, test } from "bun:test";

import { computeDrawerChatBudget } from "@/lib/rabbit-holes/drawer-chat-ui-budget";

const baseInput = {
  viewportWidthPx: 390,
  viewportHeightPx: 844,
  aiBlockMaxHeightPx: 320,
  aiBlockWidthPx: 350,
  fontSizePx: 14,
  lineHeightPx: 20,
  prefersReducedMotion: false,
} as const;

describe("computeDrawerChatBudget", () => {
  test("computes visible lines from AI block height", () => {
    const budget = computeDrawerChatBudget({ ...baseInput, sheetSnap: "full" });

    expect(budget.visibleLines).toBe(16);
    expect(budget.maxCharsPerLine).toBeGreaterThanOrEqual(24);
    expect(budget.targetWordRange[1]).toBeGreaterThan(budget.targetWordRange[0]);
  });

  test("collapsed snap tightens target word range", () => {
    const full = computeDrawerChatBudget({ ...baseInput, sheetSnap: "full" });
    const collapsed = computeDrawerChatBudget({ ...baseInput, sheetSnap: "collapsed" });

    expect(collapsed.targetWordRange[1]).toBeLessThan(full.targetWordRange[1]);
  });

  test("prompt text includes snap and dimensions", () => {
    const budget = computeDrawerChatBudget({ ...baseInput, sheetSnap: "half" });

    expect(budget.promptText).toContain("half");
    expect(budget.promptText).toContain("390");
  });
});
