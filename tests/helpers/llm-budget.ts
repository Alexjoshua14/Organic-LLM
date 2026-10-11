import * as budgetHooks from "@/lib/plans/llm-budget-hooks";
import { evaluatePlanBudget } from "@/lib/plans/plan-tags";
import { currentBudgetCycle, DEFAULT_BUDGET_CYCLE_ANCHOR } from "@/lib/plans/budget-cycle";
import { mockModulePreservingReal } from "./module-mock";

/** Model fixtures replace the external budget read/write, while retaining the SDK hooks. */
export function mockAllowedAuthenticatedBudget() {
  return mockModulePreservingReal("@/lib/plans/llm-budget-hooks", budgetHooks, (real) => ({
    createAuthenticatedLlmBudgetHooks: async (input) =>
      real.createLlmBudgetHooks(
        { ...input, ownerId: "fixture-owner" },
        {
          read: async () =>
            evaluatePlanBudget({
              plan: "free",
              source: "default",
              usedUsd: 0,
              cycle: currentBudgetCycle(DEFAULT_BUDGET_CYCLE_ANCHOR),
              resetsRemaining: 5,
            }),
          record: async () => {},
        }
      ),
  }));
}
