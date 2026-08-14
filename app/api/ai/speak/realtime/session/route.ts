import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { z } from "zod";

import { createChat } from "@/data/supabase/chat";
import { getSupabaseUserId } from "@/data/supabase/profiles";
import { compileSpeakRealtimeTools } from "@/lib/llm/compile-speak-tools";
import { createLogger } from "@/lib/logger";
import { checkLlmMessageLimit } from "@/lib/rate-limit/llm";
import {
  checkSpeakRealtimeSessionStart,
  getSpeakRealtimeModel,
  isSpeakRealtimeEnabled,
  registerSpeakRealtimeSession,
} from "@/lib/rate-limit/speak-realtime";
import { DEFAULT_SPEAK_MODALITIES, SpeakModalitiesSchema } from "@/lib/schemas/speak-modalities";
import { buildSpeakRealtimeInstructions } from "@/lib/system-prompt/speak-realtime";

export const maxDuration = 30;

const logger = createLogger("app/api/ai/speak/realtime/session/route.ts");

const SessionBodySchema = z.object({
  threadId: z.string().uuid().optional().nullable(),
  modalities: SpeakModalitiesSchema.optional(),
  createThread: z.boolean().optional().default(true),
});

export async function POST(req: Request) {
  if (!isSpeakRealtimeEnabled()) {
    return NextResponse.json({ error: "Speak Realtime is disabled" }, { status: 503 });
  }

  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return NextResponse.json({ error: "OPENAI_API_KEY is not configured" }, { status: 500 });
  }

  const clerkUser = await auth();

  if (!clerkUser?.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sbUserIdResult = await getSupabaseUserId(clerkUser.userId);

  if (sbUserIdResult.error || !sbUserIdResult.data) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const sbUserId = sbUserIdResult.data;

  let json: unknown;

  try {
    json = await req.json();
  } catch {
    json = {};
  }

  const parsed = SessionBodySchema.safeParse(json ?? {});

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const messageLimit = await checkLlmMessageLimit(sbUserId);

  if (!messageLimit.success) {
    return NextResponse.json({ error: messageLimit.error ?? "Too many requests" }, { status: 429 });
  }

  const startCheck = await checkSpeakRealtimeSessionStart(sbUserId);

  if (!startCheck.success) {
    return NextResponse.json(
      {
        error: startCheck.error ?? "Speak Realtime budget exceeded",
        budget: startCheck.budget,
      },
      { status: 402 }
    );
  }

  const modalities = parsed.data.modalities ?? DEFAULT_SPEAK_MODALITIES;
  let threadId = parsed.data.threadId ?? null;

  if (!threadId && parsed.data.createThread !== false) {
    const created = await createChat();

    if (created.error || !created.data) {
      logger.warn("POST", `Failed to create speak thread: ${created.error?.message}`);
    } else {
      threadId = created.data;
    }
  }

  const model = getSpeakRealtimeModel();
  const tools = compileSpeakRealtimeTools(modalities);
  const instructions = buildSpeakRealtimeInstructions(modalities);

  const openaiRes = await fetch("https://api.openai.com/v1/realtime/client_secrets", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      expires_after: { anchor: "created_at", seconds: 600 },
      session: {
        type: "realtime",
        model,
        instructions,
        tools,
        tool_choice: tools.length > 0 ? "auto" : "none",
        max_output_tokens: 800,
        audio: {
          input: {
            turn_detection: { type: "server_vad" },
            transcription: { model: "gpt-transcribe" },
          },
          output: {
            voice: "alloy",
          },
        },
      },
    }),
  });

  if (!openaiRes.ok) {
    const errText = await openaiRes.text().catch(() => "");

    logger.error("POST", `OpenAI client_secrets failed: ${openaiRes.status} ${errText}`);

    return NextResponse.json({ error: "Failed to mint Realtime session" }, { status: 502 });
  }

  const secretPayload = (await openaiRes.json()) as {
    value?: string;
    expires_at?: number;
    session?: { id?: string };
  };

  const clientSecret = secretPayload.value;
  const openaiSessionId = secretPayload.session?.id;
  const ourSessionId = openaiSessionId ?? crypto.randomUUID();

  if (!clientSecret) {
    return NextResponse.json({ error: "Missing ephemeral client secret" }, { status: 502 });
  }

  await registerSpeakRealtimeSession({
    sessionId: ourSessionId,
    userId: sbUserId,
    model,
    threadId,
    modalities,
  });

  logger.log("POST", `Minted speak realtime session ${ourSessionId}`, {
    model,
    threadId,
    modalities,
  });

  return NextResponse.json({
    clientSecret,
    sessionId: ourSessionId,
    expiresAt: secretPayload.expires_at ?? null,
    model,
    threadId,
    modalities,
    budget: startCheck.budget,
  });
}
