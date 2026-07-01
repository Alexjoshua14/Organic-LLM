/**
 * Noesis admin **demo-cache** route — content-addressed cache for demo threads.
 *
 * - `action: "lookup"` — the server computes the version hash from the inputs and
 *   returns any cached transcript. Reverting a prompt to a prior version is a hit.
 * - `action: "save"` — persists a freshly-generated transcript under the hash the
 *   matching `lookup` returned.
 *
 * The hash (see `lib/sandbox/noesis/demo/version.ts`) is computed server-side so the
 * client can't drift from the canonical key.
 */
import z from "zod";

import { requireLlmChatActor } from "@/lib/api/chat-llm-gate";
import { computeDemoVersionHash } from "@/lib/sandbox/noesis/demo/version";
import { getCachedDemo, putCachedDemo } from "@/lib/sandbox/noesis/demo/cache";
import { NPC_PERSONA_VERSION } from "@/lib/sandbox/noesis/demo/npc";
import { DEMO_DEFAULT_MODEL, DEMO_REPLY_CYCLES } from "@/lib/sandbox/noesis/demo/config";
import { createLogger } from "@/lib/logger";

export const maxDuration = 15;

const logger = createLogger("app/api/sandbox/topic-explore/demo-cache/route.ts");

const TurnSchema = z.object({
  role: z.enum(["user", "assistant"]),
  text: z.string(),
});

const UsageSchema = z.object({
  inputTokens: z.number(),
  outputTokens: z.number(),
  totalTokens: z.number(),
});

const LookupSchema = z.object({
  action: z.literal("lookup"),
  systemPrompt: z.string().min(1),
  kickoff: z.string().min(1),
  model: z.string().optional(),
  cycles: z.number().int().positive().optional(),
});

const SaveSchema = z.object({
  action: z.literal("save"),
  hash: z.string().min(1),
  transcript: z.array(TurnSchema).min(1),
  usage: UsageSchema.nullable().optional(),
  model: z.string().optional(),
});

const BodySchema = z.discriminatedUnion("action", [LookupSchema, SaveSchema]);

export async function POST(req: Request) {
  const gate = await requireLlmChatActor();

  if (gate.error != null) return gate.error;

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

  try {
    if (parsed.data.action === "lookup") {
      const { systemPrompt, kickoff } = parsed.data;
      const hash = computeDemoVersionHash({
        systemPrompt,
        kickoff,
        model: parsed.data.model || DEMO_DEFAULT_MODEL,
        cycles: parsed.data.cycles ?? DEMO_REPLY_CYCLES,
        npcPersonaVersion: NPC_PERSONA_VERSION,
      });
      const cached = getCachedDemo(hash);

      return Response.json({
        hit: cached != null,
        hash,
        transcript: cached?.transcript ?? null,
        usage: cached?.usage ?? null,
      });
    }

    // action === "save"
    putCachedDemo(parsed.data.hash, {
      transcript: parsed.data.transcript,
      usage: parsed.data.usage ?? null,
      model: parsed.data.model ?? null,
      createdAt: Date.now(),
    });

    return Response.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "demo_cache_failed";

    logger.error("POST", msg);

    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
