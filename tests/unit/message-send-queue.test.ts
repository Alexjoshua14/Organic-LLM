import { describe, expect, test } from "bun:test";

import {
  evaluateDispatchGates,
  shouldEnqueueInsteadOfSend,
} from "@/lib/message-queue/dispatch-gates";
import {
  evaluatePlanBudget,
  FREE_PLAN_MONTHLY_BUDGET_USD,
  parseMaxPlanClerkUserIds,
  resolvePlanTag,
} from "@/lib/plans/plan-tags";

describe("multi-mode plan tags", () => {
  test("free is the default for every user", () => {
    expect(resolvePlanTag("user_anyone")).toBe("free");
    expect(resolvePlanTag("user_anyone", "")).toBe("free");
    expect(resolvePlanTag("user_anyone", "   ")).toBe("free");
  });

  test("max plan comes only from env allowlist (Clerk ids)", () => {
    const raw = "user_alpha, user_beta";

    expect(resolvePlanTag("user_alpha", raw)).toBe("max");
    expect(resolvePlanTag("user_beta", raw)).toBe("max");
    expect(resolvePlanTag("user_gamma", raw)).toBe("free");
    expect(parseMaxPlanClerkUserIds(raw).size).toBe(2);
  });

  test("free plan is capped at $40; exhausted budget cannot dispatch", () => {
    expect(FREE_PLAN_MONTHLY_BUDGET_USD).toBe(40);

    const under = evaluatePlanBudget({ plan: "free", monthlyUsedUsd: 39.99 });

    expect(under.canDispatch).toBe(true);
    expect(under.monthlyBudgetUsd).toBe(40);

    const atCap = evaluatePlanBudget({ plan: "free", monthlyUsedUsd: 40 });

    expect(atCap.canDispatch).toBe(false);
    expect(atCap.holdReason).toMatch(/\$40/);

    const over = evaluatePlanBudget({ plan: "free", monthlyUsedUsd: 55 });

    expect(over.canDispatch).toBe(false);
  });

  test("max plan is not capped at $40 (ceiling unset)", () => {
    const snap = evaluatePlanBudget({ plan: "max", monthlyUsedUsd: 500 });

    expect(snap.canDispatch).toBe(true);
    expect(snap.monthlyBudgetUsd).toBeNull();
    expect(snap.monthlyRemainingUsd).toBeNull();
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
    const budget = evaluatePlanBudget({ plan: "free", monthlyUsedUsd: 40 });
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
    const budget = evaluatePlanBudget({ plan: "free", monthlyUsedUsd: 1 });
    const gate = evaluateDispatchGates({
      activeStreamId: null,
      canDispatchBudget: budget.canDispatch,
      budgetHoldReason: budget.holdReason,
    });

    expect(gate).toEqual({ ok: true });
  });

  test("max plan dispatches even at high usage when idle", () => {
    const budget = evaluatePlanBudget({ plan: "max", monthlyUsedUsd: 999 });
    const gate = evaluateDispatchGates({
      activeStreamId: null,
      canDispatchBudget: budget.canDispatch,
      budgetHoldReason: budget.holdReason,
    });

    expect(gate).toEqual({ ok: true });
  });
});
