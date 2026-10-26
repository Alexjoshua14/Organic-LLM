import * as budgetHooks from "@/lib/plans/llm-budget-hooks";
import { evaluatePlanBudget } from "@/lib/plans/plan-tags";
import { currentBudgetCycle, DEFAULT_BUDGET_CYCLE_ANCHOR } from "@/lib/plans/budget-cycle";
import { mockModulePreservingReal } from "./module-mock";

const fixtureBudgetDeps = {
  read: async () =>
    evaluatePlanBudget({
      plan: "free" as const,
      source: "default" as const,
      usedUsd: 0,
      cycle: currentBudgetCycle(DEFAULT_BUDGET_CYCLE_ANCHOR),
      resetsRemaining: 5,
    }),
  record: async () => {},
};

/** Model fixtures replace the external budget read/write, while retaining the SDK hooks. */
export function mockAllowedAuthenticatedBudget() {
  return mockModulePreservingReal("@/lib/plans/llm-budget-hooks", budgetHooks, (real) => ({
    createAuthenticatedLlmBudgetHooks: async (input) =>
      real.createLlmBudgetHooks({ ...input, ownerId: "fixture-owner" }, fixtureBudgetDeps),
    createOwnerLlmBudgetHooks: async (input) => real.createLlmBudgetHooks(input, fixtureBudgetDeps),
  }));
}
