import { auth } from "@clerk/nextjs/server";
import { generateText } from "ai";
import { after } from "next/server";

import { getSupabaseUserId } from "@/data/supabase/profiles";
import { persistAionPresenceTurns } from "@/lib/aion/presence/persist-turns";
import { createAionEventHandler } from "@/lib/api/aion-event-handler";
import { resolveFeatureThread } from "@/lib/chat/resolve-feature-thread";
import { formatSessionContext, loadSessionContext } from "@/lib/llm/session-context";
import { checkAionPresenceTurn, recordAionPresenceUsage } from "@/lib/rate-limit/aion-presence";
import { checkLlmMessageLimit } from "@/lib/rate-limit/llm";
import { requirePlanBudget } from "@/lib/api/plan-budget-gate";

export const maxDuration = 30;

const productionDeps = {
  auth: (() => auth()) as any,
  getSupabaseUserId,
  requirePlanBudget,
  checkLlmMessageLimit,
  checkAionPresenceTurn,
  recordAionPresenceUsage,
  resolveFeatureThread,
  loadSessionContext,
  formatSessionContext,
  generateText,
  persistAionPresenceTurns,
  after,
};

export const POST = createAionEventHandler(productionDeps);
