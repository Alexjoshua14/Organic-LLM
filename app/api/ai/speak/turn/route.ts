import { auth } from "@clerk/nextjs/server";
import { openai } from "@ai-sdk/openai";
import { generateText } from "ai";
import { NextResponse } from "next/server";
import { z } from "zod";

import { getSupabaseUserId } from "@/data/supabase/profiles";
import { checkLlmMessageLimit, recordLlmCost } from "@/lib/rate-limit/llm";
import { createLogger } from "@/lib/logger";
import { recordLlmCall } from "@/lib/llm/metrics";
import { buildSpeakRealtimeInstructions } from "@/lib/system-prompt/speak-realtime";
import { DEFAULT_SPEAK_MODALITIES } from "@/lib/schemas/speak-modalities";

export const maxDuration = 30;

const logger = createLogger("app/api/ai/speak/turn/route.ts");

/**
 * @deprecated Prefer OpenAI Realtime via `/api/ai/speak/realtime/session`.
 * Kept for temporary fallback / Read-adjacent experiments.
 */
const TurnSchema = z.object({
  message: z.string().min(1).max(4_000),
  history: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().max(8_000),
      })
    )
    .max(12)
    .optional(),
});

export async function POST(req: Request) {
  const clerkUser = await auth();

  if (!clerkUser?.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sbUserIdResult = await getSupabaseUserId(clerkUser.userId);

  if (sbUserIdResult.error || !sbUserIdResult.data) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  let json: unknown;

  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const parsed = TurnSchema.safeParse(json);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const limit = await checkLlmMessageLimit(sbUserIdResult.data);

  if (!limit.success) {
    return NextResponse.json({ error: limit.error ?? "Too many requests" }, { status: 429 });
  }

  const history = parsed.data.history ?? [];
  const messages = [
    ...history.map((h) => ({ role: h.role as "user" | "assistant", content: h.content })),
    { role: "user" as const, content: parsed.data.message },
  ];

  const start = performance.now();

  try {
    const result = await generateText({
      model: openai("gpt-4o-mini"),
      system: buildSpeakRealtimeInstructions(DEFAULT_SPEAK_MODALITIES),
      messages,
      maxOutputTokens: 600,
      temperature: 0.75,
    });

    recordLlmCall({
      model: "openai/gpt-4o-mini",
      usage: result.usage,
      durationMs: performance.now() - start,
      metadata: {
        operation: "speak-live-turn",
        route: "/api/ai/speak/turn",
        userId: sbUserIdResult.data,
      },
    });

    await recordLlmCost(sbUserIdResult.data, "openai/gpt-4o-mini", {
      inputTokens: result.usage?.inputTokens ?? 0,
      outputTokens: result.usage?.outputTokens ?? 0,
    });

    logger.log("POST", `Deprecated speak/turn reply length: ${result.text.length}`);

    return NextResponse.json({
      text: result.text,
      deprecated: true,
      prefer: "/api/ai/speak/realtime/session",
    });
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));

    logger.error("POST", `Live voice turn failed: ${err.message}`);

    return NextResponse.json({ error: "Failed to generate voice response" }, { status: 500 });
  }
}
