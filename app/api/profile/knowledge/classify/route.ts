import { performance } from "node:perf_hooks";

import { auth } from "@clerk/nextjs/server";
import { generateText } from "ai";
import { NextResponse } from "next/server";
import { z } from "zod";

import { getSupabaseUserId } from "@/data/supabase/profiles";
import { KNOWLEDGE_GATEWAY_PROVIDER_OPTIONS } from "@/lib/knowledge/gateway-options";
import { CLASSIFIER_SYSTEM_PROMPT } from "@/lib/knowledge/prompts";
import { recordLlmCall } from "@/lib/llm/metrics";
import { checkLlmMessageLimit } from "@/lib/rate-limit/llm";

export const maxDuration = 15;

const CLASSIFY_MODEL = "openai/gpt-5.4-nano";

const ClassifyBodySchema = z.object({
  text: z.string().trim().min(1).max(20_000),
});

function parseSubstantial(raw: string): boolean {
  const token = raw.trim().split(/\s+/)[0]?.toUpperCase() ?? "";

  if (token.startsWith("Y")) return true;
  if (token.startsWith("N")) return false;

  return false;
}

export async function POST(req: Request) {
  const user = await auth();

  if (!user?.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sbUserId = await getSupabaseUserId(user.userId);

  if (sbUserId.error || !sbUserId.data) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const messageLimitResult = await checkLlmMessageLimit(sbUserId.data);

  if (!messageLimitResult.success) {
    return NextResponse.json(
      { error: messageLimitResult.error ?? "Too many requests" },
      { status: 429 }
    );
  }

  let body: z.infer<typeof ClassifyBodySchema>;

  try {
    body = ClassifyBodySchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const start = performance.now();

  try {
    const { text, usage } = await generateText({
      model: CLASSIFY_MODEL,
      system: CLASSIFIER_SYSTEM_PROMPT,
      prompt: body.text,
      maxOutputTokens: 8,
      providerOptions: KNOWLEDGE_GATEWAY_PROVIDER_OPTIONS,
    });

    recordLlmCall({
      model: CLASSIFY_MODEL,
      usage,
      durationMs: performance.now() - start,
      metadata: { operation: "knowledge-classify", route: "/api/profile/knowledge/classify" },
    });

    return NextResponse.json({ substantial: parseSubstantial(text) });
  } catch {
    return NextResponse.json({ error: "Classification failed" }, { status: 500 });
  }
}
