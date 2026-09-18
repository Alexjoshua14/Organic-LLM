import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import OpenAI from "openai";
import { z } from "zod";

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
import { DEFAULT_SPEAK_THREAD_POLICY, SpeakThreadPolicySchema } from "@/lib/schemas/speak-thread";
import { resolveSpeakThread } from "@/lib/speak/resolve-speak-thread";
import {
  formatSpeakSessionContext,
  loadSpeakSessionContext,
} from "@/lib/speak/speak-session-context";
import { buildSpeakRealtimeInstructions } from "@/lib/system-prompt/speak-realtime";

export const maxDuration = 30;

const logger = createLogger("app/api/ai/speak/realtime/session/route.ts");

const SessionBodySchema = z.object({
  threadId: z.string().uuid().optional().nullable(),
  modalities: SpeakModalitiesSchema.optional(),
  /** `false` starts a thread-less session (no persistence). Older clients only send this. */
  createThread: z.boolean().optional().default(true),
  threadPolicy: SpeakThreadPolicySchema.optional(),
  /** Mirrors chat's composer memory toggle: enables `search_memories` and transcript ingest. */
  memory: z.boolean().optional(),
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
  const memoryEnabled = parsed.data.memory === true;
  const threadPolicy = parsed.data.threadPolicy ?? DEFAULT_SPEAK_THREAD_POLICY;

  const thread =
    parsed.data.createThread === false && !parsed.data.threadId
      ? { threadId: null, resumed: false, title: null }
      : await resolveSpeakThread({
          ownerId: sbUserId,
          policy: threadPolicy,
          requestedThreadId: parsed.data.threadId,
        });

  if (thread.error) {
    logger.warn("POST", `Failed to resolve speak thread: ${thread.error}`);
  }

  const threadId = thread.threadId;

  // A resumed thread has history to carry in; a fresh one has nothing to seed a search with.
  let sessionContext: string | null = null;

  if (threadId && thread.resumed) {
    const loaded = await loadSpeakSessionContext({ ownerId: sbUserId, threadId, memoryEnabled });

    sessionContext = formatSpeakSessionContext(loaded) || null;
  }

  const model = getSpeakRealtimeModel();
  const tools = compileSpeakRealtimeTools(modalities, { memoryEnabled });
  const instructions = buildSpeakRealtimeInstructions(modalities, {
    memoryEnabled,
    sessionContext,
    resumed: thread.resumed,
  });

  const openai = new OpenAI({ apiKey });

  let secretPayload: OpenAI.Realtime.ClientSecretCreateResponse;

  try {
    secretPayload = await openai.realtime.clientSecrets.create({
      expires_after: { anchor: "created_at", seconds: 600 },
      session: {
        type: "realtime",
        model,
        instructions,
        tools,
        tool_choice: tools.length > 0 ? "auto" : "none",
        max_output_tokens: 800,
        // The resumed-thread preamble lives in `instructions`. Retention-ratio truncation drops
        // old conversation items when the context fills but never the instructions themselves.
        truncation: { type: "retention_ratio", retention_ratio: 0.8 },
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
    });
  } catch (error) {
    const status = error instanceof OpenAI.APIError ? error.status : "unknown";
    const detail = error instanceof Error ? error.message : String(error);

    logger.error("POST", `OpenAI client_secrets failed: ${status} ${detail}`);

    return NextResponse.json({ error: "Failed to mint Realtime session" }, { status: 502 });
  }

  const clientSecret = secretPayload.value;
  const openaiSessionId = secretPayload.session.id;
  const ourSessionId = openaiSessionId || crypto.randomUUID();

  if (!clientSecret) {
    return NextResponse.json({ error: "Missing ephemeral client secret" }, { status: 502 });
  }

  await registerSpeakRealtimeSession({
    sessionId: ourSessionId,
    userId: sbUserId,
    model,
    threadId,
    modalities,
    memoryEnabled,
  });

  logger.log("POST", `Minted speak realtime session ${ourSessionId}`, {
    model,
    threadId,
    modalities,
    memoryEnabled,
    resumed: thread.resumed,
    contextChars: sessionContext?.length ?? 0,
  });

  return NextResponse.json({
    clientSecret,
    sessionId: ourSessionId,
    expiresAt: secretPayload.expires_at ?? null,
    model,
    threadId,
    resumed: thread.resumed,
    threadTitle: thread.title,
    modalities,
    memoryEnabled,
    budget: startCheck.budget,
  });
}
