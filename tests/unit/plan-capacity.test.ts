import { describe, expect, test } from "bun:test";

import {
  estimateRabbitHoleCostUsd,
  estimateRealtimeHourCostUsd,
  evaluateSimultaneousStreamGate,
  FREE_PLAN_MAX_SIMULTANEOUS_STREAMS,
  FREE_PLAN_PUBLISHED_RABBIT_HOLES,
  FREE_PLAN_PUBLISHED_VOICE_HOURS,
  freeBudgetMaxRabbitHoles,
  freeBudgetMaxVoiceHours,
  FREE_PLAN_WEEKLY_BUDGET_USD,
  getPublicPlanTiers,
  publishedFreeCapacityFitsBudget,
} from "@/lib/plans/plan-capacity";
import { getUsagePlanTier } from "@/lib/usage/plans";

describe("plan capacity", () => {
  test("free is $10 a week and max has a null dollar cap", () => {
    expect(FREE_PLAN_WEEKLY_BUDGET_USD).toBe(10);
    expect(getUsagePlanTier("free").costCapUsd).toBe(10);
    expect(getUsagePlanTier("max").costCapUsd).toBeNull();

    const tiers = getPublicPlanTiers();
    const free = tiers.find((t) => t.id === "free");
    const max = tiers.find((t) => t.id === "max");

    expect(free?.weeklyBudgetUsd).toBe(10);
    expect(max?.weeklyBudgetUsd).toBeNull();
    expect(tiers).toHaveLength(2);
  });

  test("budget → rabbit-hole count uses the documented sol estimate", () => {
    const perHole = estimateRabbitHoleCostUsd();

    expect(perHole).toBeCloseTo(0.056, 5);
    expect(freeBudgetMaxRabbitHoles(10)).toBe(Math.floor(10 / perHole));
    expect(freeBudgetMaxRabbitHoles(10)).toBeGreaterThanOrEqual(FREE_PLAN_PUBLISHED_RABBIT_HOLES);
  });

  test("budget → voice hours uses the realtime minute estimator", () => {
    const perHour = estimateRealtimeHourCostUsd();

    expect(perHour).toBeGreaterThan(0);
    expect(freeBudgetMaxVoiceHours(10)).toBeGreaterThanOrEqual(FREE_PLAN_PUBLISHED_VOICE_HOURS);
  });

  test("published free layman figures fit a week's $10 budget", () => {
    expect(
      publishedFreeCapacityFitsBudget({
        rabbitHoles: FREE_PLAN_PUBLISHED_RABBIT_HOLES,
        voiceHours: FREE_PLAN_PUBLISHED_VOICE_HOURS,
      })
    ).toBe(true);

    const free = getPublicPlanTiers().find((t) => t.id === "free");

    expect(free?.rabbitHoles).toBe(120);
    expect(free?.voiceHours).toBe(5);
    expect(free?.simultaneousStreams).toBe(5);
  });

  test("max does not advertise unlimited rabbit holes or voice", () => {
    const max = getPublicPlanTiers().find((t) => t.id === "max");

    expect(max?.rabbitHoles).toBeNull();
    expect(max?.voiceHours).toBeNull();
    expect(max?.simultaneousStreams).toBe(FREE_PLAN_MAX_SIMULTANEOUS_STREAMS);
  });

  test("simultaneous stream gate blocks at the published free cap", () => {
    expect(
      evaluateSimultaneousStreamGate({
        activeStreamCount: 4,
        maxStreams: FREE_PLAN_MAX_SIMULTANEOUS_STREAMS,
      }).ok
    ).toBe(true);

    const blocked = evaluateSimultaneousStreamGate({
      activeStreamCount: 5,
      maxStreams: FREE_PLAN_MAX_SIMULTANEOUS_STREAMS,
    });

    expect(blocked.ok).toBe(false);
    if (!blocked.ok) {
      expect(blocked.holdReason).toMatch(/5/);
    }
  });
});
