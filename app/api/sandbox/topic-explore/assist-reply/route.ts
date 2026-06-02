import { generateText } from "ai";
import z from "zod";

import { requireLlmChatActor } from "@/lib/api/chat-llm-gate";
import { searchMemoriesForUser } from "@/lib/memory/operations";
import {
  TOPIC_EXPLORE_ASSIST_MODEL,
  TOPIC_EXPLORE_PROVIDER_OPTIONS,
} from "@/lib/sandbox/topic-explore-llm";
import { recordLlmCall } from "@/lib/llm/metrics";
import { createLogger } from "@/lib/logger";

export const maxDuration = 30;

const logger = createLogger("app/api/sandbox/topic-explore/assist-reply/route.ts");

const TurnSchema = z.object({
  role: z.enum(["user", "assistant"]),
  text: z.string().max(12_000),
});

const BodySchema = z.object({
  lastTurns: z.array(TurnSchema).max(40),
  thoughtProfile: z.string().max(12_000).optional(),
  steerNotes: z.string().max(12_000).optional(),
});

const SYSTEM = `You are an intimate co-thinker who knows the user deeply from context you are given.

You will receive: (optional) retrieved memories, (optional) a session thought-profile, (optional) steer notes from the user, and a short transcript.

Task: write **only** the user's next chat message — what they would plausibly type next — in their voice and stance.

Rules:
- Plain text only; no quotes wrapper; no "User:" prefix; no preamble or explanation.
- Match length to the thread: if the user writes short messages, stay short; if they write longer analytical messages, you may go longer.
- Use steer notes as constraints on angle and tone when present.
- Do not claim private facts not supported by transcript + memories + profile.`;

export async function POST(req: Request) {
  const gate = await requireLlmChatActor();

  if (gate.error != null) return gate.error;

  const { sbUserId } = gate.data!;

  let json: unknown;

  try {
    json = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const parsed = BodySchema.safeParse(json);

  if (!parsed.success) {
    return new Response(JSON.stringify({ error: "Invalid body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { lastTurns, thoughtProfile, steerNotes } = parsed.data;

  const transcript = lastTurns.map((t) => `${t.role.toUpperCase()}: ${t.text}`).join("\n\n");
  const tailUser = [...lastTurns].reverse().find((t) => t.role === "user")?.text ?? "";
  const querySeed =
    tailUser.length > 0
      ? tailUser.slice(0, 1800)
      : transcript.replace(/\s+/g, " ").trim().slice(0, 1800);

  const memRes = await searchMemoriesForUser(sbUserId, querySeed || "user context", { limit: 6 });
  const memoryBlock =
    memRes.error || !memRes.data?.results?.length
      ? "(no memory hits)"
      : memRes.data.results
          .map((r) =>
            typeof r.memory === "string"
              ? `- ${r.memory.replace(/\s+/g, " ").trim().slice(0, 400)}`
              : ""
          )
          .filter(Boolean)
          .join("\n");

  const prompt = `RETRIEVED_MEMORIES:\n${memoryBlock}\n\nTHOUGHT_PROFILE:\n${thoughtProfile?.trim() || "(none)"}\n\nSTEER_NOTES:\n${steerNotes?.trim() || "(none)"}\n\nTRANSCRIPT:\n${transcript}`;

  try {
    const t0 = performance.now();
    const result = await generateText({
      model: TOPIC_EXPLORE_ASSIST_MODEL,
      system: SYSTEM,
      prompt,
      maxOutputTokens: 900,
      providerOptions: TOPIC_EXPLORE_PROVIDER_OPTIONS,
    });
    const durationMs = performance.now() - t0;

    recordLlmCall({
      model: TOPIC_EXPLORE_ASSIST_MODEL,
      usage: result.usage,
      durationMs,
      metadata: { operation: "topicExploreAssist", contextId: sbUserId },
    });

    const text = (result.text ?? "").trim();

    return Response.json({ text });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "assist_failed";

    logger.error("POST", msg);

    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
