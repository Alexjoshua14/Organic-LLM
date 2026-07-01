/**
 * NPC "main character" user simulator for demo runs.
 *
 * Given the transcript so far, generates the *next user turn* — role-playing a real
 * human exploring the topic — so a demo can play out multiple back-and-forths without
 * the admin typing. Uses the same (ultracheap) model as the spark under test.
 */
import "server-only";

import type { DemoTurn } from "./types";

import { generateText } from "ai";

import { DEMO_NPC_MAX_OUTPUT_TOKENS } from "./config";

import { TOPIC_EXPLORE_PROVIDER_OPTIONS } from "@/lib/sandbox/topic-explore-llm";
import { recordLlmCall } from "@/lib/llm/metrics";

/**
 * Bump this when {@link NPC_PERSONA_PROMPT} changes so previously-cached demos
 * (whose cache key includes this tag) invalidate and regenerate.
 */
export const NPC_PERSONA_VERSION = "npc-v1";

/** The default "main character" persona. Kept in `docs/noesis-sparks.md` for refinement. */
export const NPC_PERSONA_PROMPT = `You are role-playing a real human user exploring a topic in a chat app — the "main character" standing in for the actual user. Reply in the first person AS the user, never as the assistant.

Rules:
- Keep each message short and natural (1–3 sentences).
- Move the conversation forward: react honestly, ask a sharper follow-up, push back when you disagree, or follow a genuine tangent.
- Stay curious and a little skeptical — you are not easily satisfied by tidy answers.
- Never break character. Never mention being an AI, a model, or a simulation.
- Output ONLY your message text — no role label, no quotation marks, no stage directions.`;

export type NpcTurnResult = {
  text: string;
  usage: {
    inputTokens?: number | null;
    outputTokens?: number | null;
    totalTokens?: number | null;
  };
};

/** Generate the NPC's next user message from the transcript so far. */
export async function generateNpcUserTurn(args: {
  messages: DemoTurn[];
  /** Optional premise (e.g. the spark's user-facing text) to anchor the NPC. */
  sparkContext?: string;
  /** Model id (defaults handled by the caller). */
  model: string;
  /** For metrics correlation (e.g. Supabase user id). */
  contextId?: string;
}): Promise<NpcTurnResult> {
  const { messages, sparkContext, model, contextId } = args;

  const transcript =
    messages.length > 0
      ? messages.map((m) => `${m.role.toUpperCase()}: ${m.text}`).join("\n\n")
      : "(no transcript yet)";

  const t0 = performance.now();
  const result = await generateText({
    model,
    system: NPC_PERSONA_PROMPT,
    prompt: `${sparkContext ? `CONVERSATION_PREMISE:\n${sparkContext}\n\n` : ""}TRANSCRIPT_SO_FAR:\n${transcript}\n\nWrite ONLY your next message as the user.`,
    maxOutputTokens: DEMO_NPC_MAX_OUTPUT_TOKENS,
    providerOptions: TOPIC_EXPLORE_PROVIDER_OPTIONS,
  });
  const durationMs = performance.now() - t0;

  recordLlmCall({
    model,
    usage: result.usage,
    durationMs,
    metadata: { operation: "noesisDemoNpcTurn", contextId },
  });

  return {
    text: (result.text ?? "").trim(),
    usage: {
      inputTokens: result.usage?.inputTokens ?? null,
      outputTokens: result.usage?.outputTokens ?? null,
      totalTokens: result.usage?.totalTokens ?? null,
    },
  };
}
