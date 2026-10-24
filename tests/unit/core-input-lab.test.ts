import { describe, expect, test } from "bun:test";

import { getPrototypeBySlug } from "@/app/sandbox/prototypes/_config/prototypes";
import { makeLabBudget } from "@/app/sandbox/prototypes/core-input/_lib/lab-budget";
import {
  CORE_INPUT_LAYOUT,
  isInCoreInputHysteresisBand,
  resolveCoreInputLayoutMode,
} from "@/components/chat/core-input/layout-breakpoints";

describe("core-input lab budget fixture", () => {
  test("lands on the requested fill ratio", () => {
    for (const fill of [0, 0.25, 0.6, 0.95, 1]) {
      const budget = makeLabBudget({ modelId: "anthropic/claude-haiku-4.5", fillRatio: fill });

      expect(Math.abs(budget.fillRatio - fill)).toBeLessThan(0.002);
      expect(budget.nextSubmitTokens + budget.remainingInputTokens).toBe(budget.inputBudgetTokens);
    }
  });

  test("clamps out-of-range fills", () => {
    expect(makeLabBudget({ modelId: "organic-llm/auto", fillRatio: 1.7 }).fillRatio).toBe(1);
    expect(makeLabBudget({ modelId: "organic-llm/auto", fillRatio: -1 }).fillRatio).toBe(0);
  });

  test("drops the memory segment and tool when memory is off", () => {
    const withMemory = makeLabBudget({ modelId: "organic-llm/auto", fillRatio: 0.5 });
    const without = makeLabBudget({
      modelId: "organic-llm/auto",
      fillRatio: 0.5,
      memoryEnabled: false,
    });

    expect(withMemory.segments.some((segment) => segment.id === "memory")).toBe(true);
    expect(without.segments.some((segment) => segment.id === "memory")).toBe(false);
    expect(without.activeToolNames).not.toContain("search_memories");
    expect(without.memoriesInjected).toBe(0);
  });
});

describe("core-input layout breakpoints", () => {
  test("show thresholds sit above hide thresholds", () => {
    expect(CORE_INPUT_LAYOUT.showLabelsAtPx).toBeGreaterThan(CORE_INPUT_LAYOUT.hideLabelsAtPx);
    expect(CORE_INPUT_LAYOUT.expandedAtPx).toBeGreaterThan(CORE_INPUT_LAYOUT.condensedAtPx);
  });

  test("resolves steady-state modes and flags the band", () => {
    expect(resolveCoreInputLayoutMode(CORE_INPUT_LAYOUT.condensedAtPx - 1)).toBe("condensed");
    expect(resolveCoreInputLayoutMode(CORE_INPUT_LAYOUT.showLabelsAtPx)).toBe("labels");
    expect(resolveCoreInputLayoutMode(CORE_INPUT_LAYOUT.hideLabelsAtPx)).toBe("icons");
    expect(resolveCoreInputLayoutMode(1000, "compact")).toBe("condensed");

    expect(isInCoreInputHysteresisBand(CORE_INPUT_LAYOUT.hideLabelsAtPx)).toBe(true);
    expect(isInCoreInputHysteresisBand(CORE_INPUT_LAYOUT.showLabelsAtPx)).toBe(false);
  });
});

describe("prototype registry", () => {
  test("lists the CoreInput lab", () => {
    expect(getPrototypeBySlug("core-input")?.title).toBe("CoreInput lab");
  });
});
