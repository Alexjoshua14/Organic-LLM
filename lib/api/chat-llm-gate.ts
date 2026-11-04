import type { Result } from "@/types";

import { auth } from "@clerk/nextjs/server";

import { createLogger } from "@/lib/logger";
import { countOwnerActiveStreams } from "@/data/supabase/message-send-queue";
import { getSupabaseUserId } from "@/data/supabase/profiles";
import { ProfileNotFoundError } from "@/data/supabase/profile-id-lookup";
import {
  evaluateSimultaneousStreamGate,
  FREE_PLAN_MAX_SIMULTANEOUS_STREAMS,
} from "@/lib/plans/plan-capacity";
import { planLimitResponse } from "@/lib/api/plan-budget-gate";
import { getPlanBudgetForUser } from "@/lib/plans/plan-budget";
import { checkLlmMessageLimit } from "@/lib/rate-limit/llm";

export type LlmChatActorData = { sbUserId: string; clerkUserId: string };

const logger = createLogger("lib/api/chat-llm-gate.ts");
const defaultDeps = {
  userId: async () => (await auth()).userId,
  profile: getSupabaseUserId,
  messageLimit: checkLlmMessageLimit,
  activeStreams: countOwnerActiveStreams,
  budget: getPlanBudgetForUser,
};

function rejected(
  status: number,
  code: string,
  error: string,
  retryAfter?: number
): Result<LlmChatActorData, Response> {
  return {
    data: null,
    error: Response.json(
      { error, status, code },
      {
        status,
        headers: {
          "Cache-Control": "no-store",
          ...(retryAfter !== undefined ? { "Retry-After": String(retryAfter) } : {}),
        },
      }
    ),
  };
}

/** Authenticate and check capacity/budget. Dependency failures return retryable 503s.
 * planBudget=false is only for routes that never call a model.
 */
export async function requireLlmChatActor(
  options: { planBudget?: boolean } = {},
  deps = defaultDeps
): Promise<Result<LlmChatActorData, Response>> {
  let stage = "auth";

  try {
    const clerkUserId = await deps.userId();

    if (!clerkUserId) return rejected(401, "unauthorized", "Unauthorized");
    stage = "profile";
    const profile = await deps.profile(clerkUserId);

    if (profile.error instanceof ProfileNotFoundError || (!profile.error && !profile.data)) {
      return rejected(404, "profile_not_found", "User profile not found");
    }
    if (profile.error) throw profile.error;
    const sbUserId = profile.data!;

    stage = "rate_limit";
    const limit = await deps.messageLimit(sbUserId);

    if (!limit.success) {
      const retryAfter =
        typeof limit.reset === "number" && Number.isFinite(limit.reset) && limit.reset > 0
          ? Math.max(1, Math.ceil((limit.reset - Date.now()) / 1000))
          : undefined;

      return rejected(429, "message_limit", limit.error ?? "Too many requests", retryAfter);
    }

    stage = "stream_capacity";
    const activeStreamCount = await deps.activeStreams(sbUserId);
    const streamGate = evaluateSimultaneousStreamGate({
      activeStreamCount,
      maxStreams: FREE_PLAN_MAX_SIMULTANEOUS_STREAMS,
    });

    if (!streamGate.ok) return rejected(429, "stream_limit", streamGate.holdReason);

    if (options.planBudget !== false) {
      stage = "plan";
      const budget = await deps.budget({ clerkUserId, ownerId: sbUserId });

      if (!budget.canDispatch) return { data: null, error: planLimitResponse(budget) };
    }

    return { data: { sbUserId, clerkUserId }, error: null };
  } catch (error) {
    // Do not expose provider errors or credentials in the response or logs: log the error's
    // class and machine code (e.g. a Postgres SQLSTATE) to tell causes apart, never its message.
    const code =
      typeof error === "object" && error !== null && "code" in error ? error.code : undefined;

    logger.error("requireLlmChatActor", "Chat gate dependency unavailable", {
      stage,
      errorName: error instanceof Error ? error.name : typeof error,
      errorCode: typeof code === "string" || typeof code === "number" ? code : undefined,
    });

    return rejected(503, `${stage}_unavailable`, "Chat temporarily unavailable. Please retry.", 30);
  }
}
