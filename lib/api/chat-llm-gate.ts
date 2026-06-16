import type { Result } from "@/types";

import { auth } from "@clerk/nextjs/server";

import { getSupabaseUserId } from "@/data/supabase/profiles";
import { checkLlmMessageLimit } from "@/lib/rate-limit/llm";

export type LlmChatActorData = { sbUserId: string };

/**
 * Clerk session + Supabase profile + LLM message rate limit.
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

  return { data: { sbUserId }, error: null };
}
