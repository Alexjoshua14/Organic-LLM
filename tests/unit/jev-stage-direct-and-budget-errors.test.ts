import { describe, expect, test } from "bun:test";

import {
  estimateOutputCostUsd,
  RespondOutputBudgetExceededError,
} from "@/lib/jev-stage/budget";
import { JEV_STAGE_RESPOND_OUTPUT_BUDGET_USD } from "@/lib/jev-stage/constants";
import { executeJevDirectTool } from "@/lib/jev-stage/direct-tools";
import {
  invalidSelectedActionReason,
  settingsBlockReason,
} from "@/lib/jev-stage/validate-action";
import { emptyStageState } from "@/lib/stage/schema";

describe("jev-stage direct tools", () => {
  test("view_switch rejects an invalid view without mutating widgets", async () => {
    const state = emptyStageState();
    const result = await executeJevDirectTool({
      ownerId: "00000000-0000-0000-0000-000000000001",
      state,
      selected: {
        kind: "view_switch",
        confidence: 0.9,
        reason: "bad view",
        args: { view: { kind: "nope" } },
      },
      message: "show overview",
      requestId: "00000000-0000-4000-8000-000000000002",
    });

    expect(result.note).toMatch(/invalid/i);
    expect(result.state.widgets).toEqual(state.widgets);
    expect(result.state.revision).toBe(state.revision);
  });
});

describe("jev-stage respond budget errors", () => {
  test("RespondOutputBudgetExceededError names the $0.10 cap", () => {
    const tokens = 50_000;
    const cost = estimateOutputCostUsd("openai/gpt-6.2-sol", tokens);
    const error = new RespondOutputBudgetExceededError(
      "openai/gpt-6.2-sol",
      tokens,
      cost,
      JEV_STAGE_RESPOND_OUTPUT_BUDGET_USD
    );

    expect(error.message).toContain("$0.10");
    expect(error.budgetUsd).toBe(0.1);
    expect(cost).toBeGreaterThan(JEV_STAGE_RESPOND_OUTPUT_BUDGET_USD);
  });
});

describe("jev-stage action validation", () => {
  test("empty captures fall through instead of a no-op success", () => {
    expect(
      invalidSelectedActionReason({
        kind: "captures",
        confidence: 0.99,
        reason: "file these",
        args: { captures: [] },
      })
    ).toMatch(/captures/i);
  });

  test("settings block memory and web when toggled off", () => {
    expect(settingsBlockReason("memory_search", { memory: false })).toMatch(/memory/i);
    expect(settingsBlockReason("web_search", { webSearch: false })).toMatch(/web/i);
    expect(settingsBlockReason("web_search", { webSearch: true })).toBeNull();
  });
});
