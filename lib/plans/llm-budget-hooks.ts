import "server-only";

import type { LanguageModel, LanguageModelUsage } from "ai";
import type { PlanBudgetSnapshot } from "@/lib/plans/plan-tags";

import { getPlanBudgetForUser } from "@/lib/plans/plan-budget";
import { recordGatewayCallUsage } from "@/lib/usage/record-gateway-call";
import { auth } from "@clerk/nextjs/server";
import { getSupabaseUserId } from "@/data/supabase/profiles";

type BudgetHookInput = {
  ownerId: string;
  clerkUserId?: string;
  modelId: string;
  operation: string;
  route?: string;
};
type StepUsage = { usage: LanguageModelUsage; providerMetadata?: unknown };
type BudgetHookDeps = {
  read(input: { ownerId: string; clerkUserId?: string }): Promise<PlanBudgetSnapshot>;
  record(input: BudgetHookInput & StepUsage): Promise<void>;
};

/** Direct providers report a bare model slug; the price registry uses provider/model IDs. */
export function budgetModelId(model: LanguageModel): string {
  if (typeof model === "string") return model;
  return model.modelId.includes("/")
    ? model.modelId
    : `${model.provider.split(".")[0]}/${model.modelId}`;
}

/** Check again before every model step, after awaiting the previous step's ledger entry. */
export function createLlmBudgetHooks(
  input: BudgetHookInput,
  deps: BudgetHookDeps = {
    read: getPlanBudgetForUser,
    record: recordGatewayCallUsage,
  }
) {
  let ledgerFailure: Error | null = null;
  return {
    prepareStep: async () => {
      // SDK 7 awaits notification callbacks but swallows their errors. Retain the failure
      // and throw from prepareStep, which is part of the generation control flow.
      if (ledgerFailure) throw ledgerFailure;
      const budget = await deps.read(input);
      if (!budget.canDispatch)
        throw new Error(
          JSON.stringify({
            error: budget.holdReason,
            status: budget.status === "unavailable" ? 503 : 429,
            code: budget.status === "unavailable" ? "plan_unavailable" : "plan_limit",
            resetAt: budget.cycleEnd,
            resetsRemaining: budget.resetsRemaining,
          })
        );
      return {};
    },
    onStepFinish: async (step: StepUsage) => {
      try {
        await deps.record({ ...input, usage: step.usage, providerMetadata: step.providerMetadata });
      } catch {
        ledgerFailure = new Error("Usage ledger unavailable; further model steps are paused");
        throw ledgerFailure;
      }
    },
  };
}

/** For server actions/helpers: resolve identity from the request, never from action arguments. */
export async function createAuthenticatedLlmBudgetHooks(
  input: Omit<BudgetHookInput, "ownerId" | "clerkUserId">
) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");
  const profile = await getSupabaseUserId(userId);
  if (!profile.data || profile.error) throw new Error("User not found");
  const hooks = createLlmBudgetHooks({ ...input, ownerId: profile.data, clerkUserId: userId });
  // generateObject has no prepareStep hook. This initial check protects both SDK APIs.
  await hooks.prepareStep();
  return hooks;
}
