import { generateObject, type LanguageModelUsage } from "ai";

import { createAutoModelHandler } from "@/lib/api/auto-model-handler";
import { requireLlmChatActor } from "@/lib/api/chat-llm-gate";
import { defaultJevGenerate } from "@/lib/llm/jev";
import {
  routeAutoModel,
  type AutoPickerGenerateFn,
  type JevGateGenerateFn,
} from "@/lib/llm/auto-model-router";
import { budgetModelId, createAuthenticatedLlmBudgetHooks } from "@/lib/plans/llm-budget-hooks";
import { getPlanBudgetForUser } from "@/lib/plans/plan-budget";

const PICKER_MAX_OUTPUT_TOKENS = 160;
/** Jev answers in well under a second; a hung gate should not hold the picker. */
const JEV_GATE_TIMEOUT_MS = 2_500;

/**
 * Live model calls for the router. The hooks re-check the plan budget before the call and write
 * its usage to the ledger; the router itself stays free of server-only code because client
 * components import it.
 */
const generateGate: JevGateGenerateFn = async (args) => {
  // Jev is a decision model: no generate* hooks apply, so check and record around the call.
  const hooks = await createAuthenticatedLlmBudgetHooks({
    modelId: args.model,
    operation: "auto-model-gate",
    route: "/api/chat/auto-model",
  });
  const res = await defaultJevGenerate({
    model: args.model,
    state: args.state,
    questions: args.questions,
    providerOptions: args.providerOptions,
    abortSignal: AbortSignal.timeout(JEV_GATE_TIMEOUT_MS),
  });

  await hooks.onStepFinish({
    usage: res.usage as LanguageModelUsage,
    providerMetadata: res.providerMetadata,
  });

  return res;
};

const generatePicker: AutoPickerGenerateFn = async (args) => {
  const res = await generateObject({
    ...(await createAuthenticatedLlmBudgetHooks({
      modelId: budgetModelId(args.model),
      operation: "auto-model-picker",
      route: "/api/chat/auto-model",
    })),
    model: args.model,
    instructions: args.system,
    prompt: args.prompt,
    schema: args.schema,
    providerOptions: args.providerOptions,
    maxOutputTokens: PICKER_MAX_OUTPUT_TOKENS,
  });

  return { object: res.object, usage: res.usage };
};

export const POST = createAutoModelHandler({
  requireActor: () => requireLlmChatActor({ planBudget: false }),
  planBudgetAllows: async ({ clerkUserId, sbUserId }) =>
    (await getPlanBudgetForUser({ clerkUserId, ownerId: sbUserId })).canDispatch,
  route: routeAutoModel,
  generateGate,
  generatePicker,
  hasGatewayKey: () => Boolean(process.env.AI_GATEWAY_API_KEY),
});
