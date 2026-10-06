/**
 * Noesis admin **npc-turn** route — generates the next simulated *user* message.
 *
 * The demo overlay calls this between spark replies so a conversation can play out
 * without the admin typing. Role-plays a "main character" user (see
 * `lib/sandbox/noesis/demo/npc.ts`). Returns `{ text, usage }`.
 */
import z from "zod";

import { requireLlmChatActor } from "@/lib/api/chat-llm-gate";
import { generateNpcUserTurn } from "@/lib/sandbox/noesis/demo/npc";
import { DEMO_DEFAULT_MODEL } from "@/lib/sandbox/noesis/demo/config";
import { createLogger } from "@/lib/logger";

export const maxDuration = 30;

const logger = createLogger("app/api/sandbox/topic-explore/npc-turn/route.ts");

const TurnSchema = z.object({
  role: z.enum(["user", "assistant"]),
  text: z.string().max(12_000),
});

const BodySchema = z.object({
  messages: z.array(TurnSchema).min(1).max(50),
  sparkContext: z.string().max(2_000).optional(),
  model: z.string().optional(),
});

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

  const { messages, sparkContext } = parsed.data;
  const model = parsed.data.model || DEMO_DEFAULT_MODEL;

  try {
    const { text, usage } = await generateNpcUserTurn({
      messages,
      sparkContext,
      model,
      contextId: sbUserId,
    });

    return Response.json({ text, usage });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "npc_turn_failed";

    logger.error("POST", msg);

    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
