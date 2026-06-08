import { performance } from "node:perf_hooks";

import { auth } from "@clerk/nextjs/server";
import { streamText } from "ai";
import { z } from "zod";

import { getProfile, getSupabaseUserId } from "@/data/supabase/profiles";
import { formatMemoriesBlock } from "@/lib/knowledge/build-prompt";
import { KNOWLEDGE_GATEWAY_PROVIDER_OPTIONS } from "@/lib/knowledge/gateway-options";
import { KNOWLEDGE_INJECTION_GUARDRAIL, KNOWLEDGE_SYSTEM_PROMPT } from "@/lib/knowledge/prompts";
import { recordLlmCall } from "@/lib/llm/metrics";
import { searchMemoriesForUser } from "@/lib/memory/operations";
import { checkLlmMessageLimit } from "@/lib/rate-limit/llm";
import { createLogger } from "@/lib/logger";

export const maxDuration = 30;

const KNOWLEDGE_MODEL = "anthropic/claude-haiku-4.5";

const KnowledgeBodySchema = z.object({
  displayName: z.string().trim().min(1).max(120).optional(),
});

const logger = createLogger("app/api/profile/knowledge/route.ts");

export async function POST(req: Request) {
  const user = await auth();

  if (!user?.userId) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const sbUserId = await getSupabaseUserId(user.userId);

  if (sbUserId.error || !sbUserId.data) {
    return new Response(JSON.stringify({ error: "User not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  const messageLimitResult = await checkLlmMessageLimit(sbUserId.data);

  if (!messageLimitResult.success) {
    return new Response(
      JSON.stringify({ error: messageLimitResult.error ?? "Too many requests" }),
      { status: 429, headers: { "Content-Type": "application/json" } }
    );
  }

  let parsedBody: z.infer<typeof KnowledgeBodySchema> = {};

  try {
    const json = await req.json().catch(() => ({}));

    parsedBody = KnowledgeBodySchema.parse(json);
  } catch {
    return new Response(JSON.stringify({ error: "Invalid request body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const profileResult = await getProfile(user.userId);
  const profile = profileResult.data;
  const displayName = parsedBody.displayName?.trim() || profile?.display_name?.trim() || "User";

  const memoryQuery =
    "profile biography identity work projects skills interests preferences goals personal context";

  const memoryResult = await searchMemoriesForUser(sbUserId.data, memoryQuery, { limit: 40 });
  const memories = memoryResult.data?.results ?? [];

  if (memoryResult.error) {
    logger.log("POST", `Memory search error: ${memoryResult.error}`);
  }

  const profileTreeJson =
    profile?.profile_tree != null ? JSON.stringify(profile.profile_tree) : null;

  const memoriesBlock = formatMemoriesBlock(memories, 40);

  const system = `${KNOWLEDGE_SYSTEM_PROMPT}\n\n${KNOWLEDGE_INJECTION_GUARDRAIL}`;

  const prompt = `What do you know about ${displayName}?

PROFILE_TREE (JSON or none):
${profileTreeJson ?? "none"}

MEMORIES (evidence snippets):
${memoriesBlock}`;

  const start = performance.now();

  const result = streamText({
    model: KNOWLEDGE_MODEL,
    system,
    prompt,
    maxOutputTokens: 900,
    providerOptions: KNOWLEDGE_GATEWAY_PROVIDER_OPTIONS,
    onFinish: ({ usage }) => {
      recordLlmCall({
        model: KNOWLEDGE_MODEL,
        usage,
        durationMs: performance.now() - start,
        metadata: { operation: "knowledge-summary", route: "/api/profile/knowledge" },
      });
    },
    onError: ({ error }) => {
      const e = error instanceof Error ? error : new Error(String(error));

      logger.error("POST", `Stream error: ${e.message}`);
    },
  });

  return result.toTextStreamResponse();
}
