import type { RabbitHoleToolsetDeps } from "./deps";

import {
  getAllSessions,
  getRabbitHoleNodeSearchRows,
  getRabbitHoleSessionOwnerId,
  getSessionById,
} from "@/data/supabase/rabbitholes";
import { getPlanBudgetForUser } from "@/lib/plans/plan-budget";
import { checkRabbitHoleNodeLimit } from "@/lib/rate-limit/llm";
import { scheduleNodeGeneration } from "@/lib/rabbit-holes/scheduleNodeGeneration";

/**
 * The gates `/api/rabbitholes/[sessionId]/generate` applies, for creation that happens inside a
 * chat turn. The plan lookup omits the Clerk id (the tool only has the Supabase user), which can
 * only make it stricter: it skips the max-plan override, it never grants extra.
 */
async function checkSpend(sbUserId: string) {
  const limit = await checkRabbitHoleNodeLimit(sbUserId);

  if (!limit.success) {
    return { ok: false as const, error: limit.error ?? "Rabbit Hole node limit exceeded" };
  }

  const budget = await getPlanBudgetForUser({ ownerId: sbUserId });

  if (!budget.canDispatch) {
    return { ok: false as const, error: budget.holdReason ?? "Plan usage limit reached" };
  }

  return { ok: true as const };
}

export const defaultRabbitHoleToolsetDeps: RabbitHoleToolsetDeps = {
  listSessions: () => getAllSessions(),
  getNodeSearchRows: (sessionIds) => getRabbitHoleNodeSearchRows(sessionIds),
  getSession: (sessionId) => getSessionById(sessionId),
  getSessionOwnerId: (sessionId) => getRabbitHoleSessionOwnerId(sessionId),
  checkSpend,
  scheduleGeneration: (params) => scheduleNodeGeneration(params),
  newId: () => crypto.randomUUID(),
  now: () => new Date().toISOString(),
};
