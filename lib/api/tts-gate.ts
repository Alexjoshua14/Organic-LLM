import "server-only";

import type { Result } from "@/types";

import { auth } from "@clerk/nextjs/server";

import { getSupabaseUserId } from "@/data/supabase/profiles";
import { checkLlmMessageLimit } from "@/lib/rate-limit/llm";
import { checkTtsCharLimit, checkTtsRequestLimit } from "@/lib/rate-limit/tts";

export type TtsActorData = { sbUserId: string };

/**
 * Clerk session + Supabase profile + LLM message + TTS rate limits.
 * On failure, `error` is a JSON `Response` (401 / 404 / 429).
 *
 * @param charCount - Length of the input text for this TTS request (`text.length`).
 *   When provided, enforces the per-user TTS character budget (default 50k chars/min via
 *   `TTS_RATE_LIMIT_CHARS`) in addition to the request-count limit. Omitted skips the
 *   character check (request and LLM limits still apply).
 */
export async function requireTtsActor(charCount?: number): Promise<Result<TtsActorData, Response>> {
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

  const ttsRequestLimitResult = await checkTtsRequestLimit(sbUserId);

  if (!ttsRequestLimitResult.success) {
    return {
      data: null,
      error: new Response(
        JSON.stringify({
          error: ttsRequestLimitResult.error ?? "Too many requests",
          status: 429,
        }),
        { status: 429, headers: { "Content-Type": "application/json" } }
      ),
    };
  }

  if (charCount !== undefined) {
    const charLimitResult = await checkTtsCharLimit(sbUserId, charCount);

    if (!charLimitResult.success) {
      return {
        data: null,
        error: new Response(
          JSON.stringify({
            error: charLimitResult.error ?? "Too many requests",
            status: 429,
          }),
          { status: 429, headers: { "Content-Type": "application/json" } }
        ),
      };
    }
  }

  return { data: { sbUserId }, error: null };
}
