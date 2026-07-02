import { describe, expect, test } from "bun:test";

import {
  aggregateUsageEvents,
  startOfBillingCycle,
} from "@/lib/usage/aggregate";
import {
  computePlanAllotmentPercent,
  formatPlanTooltip,
  getUsagePlanTier,
} from "@/lib/usage/plans";

describe("usage aggregate", () => {
  test("aggregates daily buckets and model breakdown", () => {
    const rangeStart = new Date("2026-06-01T00:00:00.000Z");
    const rangeEnd = new Date("2026-06-03T23:59:59.000Z");

    const result = aggregateUsageEvents(
      [
        {
          id: "1",
          owner_id: "user",
          model_id: "openai/gpt-4o-mini",
          input_tokens: 100,
          output_tokens: 50,
          cached_input_tokens: 0,
          reasoning_tokens: 0,
          total_tokens: 150,
          cost_usd: 0.000045,
          operation: "chat",
          route: "/api/chat",
          created_at: "2026-06-01T12:00:00.000Z",
        },
        {
          id: "2",
          owner_id: "user",
          model_id: "openai/gpt-4o-mini",
          input_tokens: 200,
          output_tokens: 100,
          cached_input_tokens: 40,
          reasoning_tokens: 0,
          total_tokens: 300,
          cost_usd: 0.00009,
          operation: "chat",
          route: "/api/chat",
          created_at: "2026-06-03T08:00:00.000Z",
        },
      ],
      rangeStart,
      rangeEnd
    );

    expect(result.totals.totalTokens).toBe(450);
    expect(result.daily).toHaveLength(3);
    expect(result.daily[0].totalTokens).toBe(150);
    expect(result.daily[1].totalTokens).toBe(0);
    expect(result.byModel).toHaveLength(1);
    expect(result.byModel[0].callCount).toBe(2);
    expect(result.totals.cachedInputTokens).toBe(40);
  });

  test("startOfBillingCycle is first day of month UTC", () => {
    const start = startOfBillingCycle(new Date("2026-06-15T12:00:00.000Z"));

    expect(start.toISOString()).toBe("2026-06-01T00:00:00.000Z");
  });
});

describe("usage plans", () => {
  test("allotment uses higher of token or cost percent", () => {
    const plan = getUsagePlanTier("free");

    expect(
      computePlanAllotmentPercent({
        plan,
        billingCycleTokens: 250_000,
        billingCycleCostUsd: 1.5,
      })
    ).toBe(50);

    expect(
      computePlanAllotmentPercent({
        plan,
        billingCycleTokens: 100_000,
        billingCycleCostUsd: 12,
      })
    ).toBe(80);
  });

  test("formatPlanTooltip includes price and caps", () => {
    expect(formatPlanTooltip(getUsagePlanTier("plus"))).toContain("$20/mo");
    expect(formatPlanTooltip(getUsagePlanTier("plus"))).toContain("10M tokens");
  });
});
