import { generateText } from "ai";
import z from "zod";

import { requireLlmChatActor } from "@/lib/api/chat-llm-gate";
import {
  TOPIC_EXPLORE_PROVIDER_OPTIONS,
  TOPIC_EXPLORE_STEER_MODEL,
} from "@/lib/sandbox/topic-explore-llm";
import { recordLlmCall } from "@/lib/llm/metrics";
import { createLogger } from "@/lib/logger";

export const maxDuration = 30;

const logger = createLogger("app/api/sandbox/topic-explore/steer/route.ts");

const TurnSchema = z.object({
  role: z.enum(["user", "assistant"]),
  text: z.string().max(12_000),
});

const BodySchema = z.object({
  instruction: z.string().min(1).max(6000),
  lastTurns: z.array(TurnSchema).max(40).optional(),
});

const SYSTEM = `You help the user steer an *assist model* that will draft their next chat message.

The user's instruction is natural language about what the assist should emphasize (e.g. ask a harder question, zoom out, steelman the counterargument).

Output **plain markdown** guidance for that assist model (bullet list is fine). Do not roleplay as the user. Do not write the user's next message — only steering notes.`;

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

  const { instruction, lastTurns } = parsed.data;
  const transcript =
    lastTurns && lastTurns.length > 0
      ? lastTurns.map((t) => `${t.role.toUpperCase()}: ${t.text}`).join("\n\n")
      : "(no transcript)";

  try {
    const t0 = performance.now();
    const result = await generateText({
      model: TOPIC_EXPLORE_STEER_MODEL,
      system: SYSTEM,
      prompt: `RECENT_TRANSCRIPT:\n${transcript}\n\nUSER_STEER_INSTRUCTION:\n${instruction}`,
      maxOutputTokens: 700,
      providerOptions: TOPIC_EXPLORE_PROVIDER_OPTIONS,
    });
    const durationMs = performance.now() - t0;

    recordLlmCall({
      model: TOPIC_EXPLORE_STEER_MODEL,
      usage: result.usage,
      durationMs,
      metadata: { operation: "topicExploreSteer", contextId: sbUserId },
    });

    return Response.json({ text: (result.text ?? "").trim() });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "steer_failed";

    logger.error("POST", msg);

    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
