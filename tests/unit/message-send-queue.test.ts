import { describe, expect, test } from "bun:test";

import {
  evaluateDispatchGates,
  shouldEnqueueInsteadOfSend,
} from "@/lib/message-queue/dispatch-gates";
import { evaluatePlanBudget, parseMaxPlanClerkUserIds, resolvePlan } from "@/lib/plans/plan-tags";

const WEEK = {
  start: new Date("2026-10-05T00:00:00.000Z"),
  end: new Date("2026-10-12T00:00:00.000Z"),
};

describe("plan budget", () => {
  test("free is the default for every user and unknown stored plans", () => {
    expect(resolvePlan({ clerkUserId: "user_anyone", storedPlan: null, envRaw: "" })).toBe("free");
    expect(resolvePlan({ clerkUserId: "user_anyone", storedPlan: "platinum", envRaw: "" })).toBe(
      "free"
    );
    expect(resolvePlan({ clerkUserId: "user_anyone", storedPlan: "pro", envRaw: "   " })).toBe(
      "pro"
    );
  });

  test("the env allowlist is a break-glass override to max (Clerk ids)", () => {
    const raw = "user_alpha, user_beta";

    expect(resolvePlan({ clerkUserId: "user_alpha", storedPlan: "free", envRaw: raw })).toBe("max");
    expect(resolvePlan({ clerkUserId: "user_gamma", storedPlan: "free", envRaw: raw })).toBe(
      "free"
    );
    expect(parseMaxPlanClerkUserIds(raw).size).toBe(2);
  });

  test("free is capped at $10 a week; a spent budget cannot dispatch", () => {
    const base = {
      plan: "free" as const,
      source: "entitlements" as const,
      cycle: WEEK,
      resetsRemaining: 5,
    };
    const under = evaluatePlanBudget({ ...base, usedUsd: 9.99 });

    expect(under.canDispatch).toBe(true);
    expect(under.capUsd).toBe(10);
    expect(under.cycleEnd).toBe("2026-10-12T00:00:00.000Z");

    const atCap = evaluatePlanBudget({ ...base, usedUsd: 10 });

    expect(atCap.canDispatch).toBe(false);
    expect(atCap.holdReason).toMatch(/\$10/);
    expect(evaluatePlanBudget({ ...base, usedUsd: 55 }).canDispatch).toBe(false);
  });

  test("max has no weekly cap", () => {
    const snap = evaluatePlanBudget({
      plan: "max",
      source: "override",
      cycle: WEEK,
      usedUsd: 500,
      resetsRemaining: null,
    });

    expect(snap.canDispatch).toBe(true);
    expect(snap.capUsd).toBeNull();
    expect(snap.remainingUsd).toBeNull();
    expect(snap.holdReason).toBeNull();
  });
});

describe("multi-mode dispatch gates", () => {
  test("enqueue mode does not block the composer path", () => {
    expect(shouldEnqueueInsteadOfSend(true)).toBe(true);
    expect(shouldEnqueueInsteadOfSend(false)).toBe(false);
  });

  test("dispatch waits while streaming", () => {
    const gate = evaluateDispatchGates({
      activeStreamId: "stream-abc",
      canDispatchBudget: true,
      budgetHoldReason: null,
    });

    expect(gate.ok).toBe(false);
    if (!gate.ok) {
      expect(gate.status).toBe("blocked_streaming");
    }
  });

  test("dispatch waits when free budget is exhausted", () => {
    const budget = evaluatePlanBudget({
      plan: "free",
      source: "entitlements",
      cycle: WEEK,
      usedUsd: 10,
      resetsRemaining: 0,
    });
    const gate = evaluateDispatchGates({
      activeStreamId: null,
      canDispatchBudget: budget.canDispatch,
      budgetHoldReason: budget.holdReason,
    });

    expect(gate.ok).toBe(false);
    if (!gate.ok) {
      expect(gate.status).toBe("blocked_budget");
    }
  });

  test("dispatch proceeds when idle and under budget", () => {
    const budget = evaluatePlanBudget({
      plan: "free",
      source: "entitlements",
      cycle: WEEK,
      usedUsd: 1,
      resetsRemaining: 5,
    });
    const gate = evaluateDispatchGates({
      activeStreamId: null,
      canDispatchBudget: budget.canDispatch,
      budgetHoldReason: budget.holdReason,
    });

    expect(gate).toEqual({ ok: true });
  });

  test("max plan dispatches even at high usage when idle", () => {
    const budget = evaluatePlanBudget({
      plan: "max",
      source: "override",
      cycle: WEEK,
      usedUsd: 999,
      resetsRemaining: null,
    });
    const gate = evaluateDispatchGates({
      activeStreamId: null,
      canDispatchBudget: budget.canDispatch,
      budgetHoldReason: budget.holdReason,
    });

    expect(gate).toEqual({ ok: true });
  });
});
