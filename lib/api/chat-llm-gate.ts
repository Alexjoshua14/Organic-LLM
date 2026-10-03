import type { Result } from "@/types";

import { auth } from "@clerk/nextjs/server";

import { countOwnerActiveStreams } from "@/data/supabase/message-send-queue";
import { getSupabaseUserId } from "@/data/supabase/profiles";
import {
  evaluateSimultaneousStreamGate,
  FREE_PLAN_MAX_SIMULTANEOUS_STREAMS,
} from "@/lib/plans/plan-capacity";
import { checkLlmMessageLimit } from "@/lib/rate-limit/llm";

export type LlmChatActorData = { sbUserId: string; clerkUserId: string };

/**
 * Clerk session + Supabase profile + LLM message rate limit + simultaneous stream cap.
 * On failure, `error` is a JSON `Response` (401 / 404 / 429) matching the main chat route.
 */
export async function requireLlmChatActor(): Promise<Result<LlmChatActorData, Response>> {
  const clerkUser = await auth();

  if (!clerkUser?.userId) {
    return {
      data: null,
      error: new Response(JSON.stringify({ error: "Unauthorized", status: 401 }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      }),
    };
  }

  const sbUserIdResult = await getSupabaseUserId(clerkUser.userId);

  if (sbUserIdResult.error || sbUserIdResult.data === null) {
    return {
      data: null,
      error: new Response(
        JSON.stringify({
          error: "User not found in supabase",
          status: 404,
        }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      ),
    };
  }

  const sbUserId = sbUserIdResult.data;
  const messageLimitResult = await checkLlmMessageLimit(sbUserId);

  if (!messageLimitResult.success) {
    return {
      data: null,
      error: new Response(
        JSON.stringify({
          error: messageLimitResult.error ?? "Too many requests",
          status: 429,
        }),
        { status: 429, headers: { "Content-Type": "application/json" } }
      ),
    };
  }

  const activeStreamCount = await countOwnerActiveStreams(sbUserId);
  const streamGate = evaluateSimultaneousStreamGate({
    activeStreamCount,
    maxStreams: FREE_PLAN_MAX_SIMULTANEOUS_STREAMS,
  });

  if (!streamGate.ok) {
    return {
      data: null,
      error: new Response(
        JSON.stringify({
          error: streamGate.holdReason,
          status: 429,
        }),
        { status: 429, headers: { "Content-Type": "application/json" } }
      ),
    };
  }

  return { data: { sbUserId, clerkUserId: clerkUser.userId }, error: null };
}
