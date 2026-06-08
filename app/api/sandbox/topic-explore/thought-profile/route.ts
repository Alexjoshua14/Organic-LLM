import { generateText } from "ai";
import z from "zod";

import { requireLlmChatActor } from "@/lib/api/chat-llm-gate";
import {
  TOPIC_EXPLORE_PROVIDER_OPTIONS,
  TOPIC_EXPLORE_THOUGHT_MODEL,
} from "@/lib/sandbox/topic-explore-llm";
import { recordLlmCall } from "@/lib/llm/metrics";
import { createLogger } from "@/lib/logger";

export const maxDuration = 30;

const logger = createLogger("app/api/sandbox/topic-explore/thought-profile/route.ts");

const BodySchema = z.object({
  previousProfile: z.string().max(12_000).optional(),
  newUserTexts: z.array(z.string().max(8000)).min(1).max(24),
});

const SYSTEM = `You maintain a **session-local** profile of the user's *thinking style* (not biography).

Merge new user-only messages into the prior profile (if any). Output **markdown only**, no JSON.

Include when visible:
- Recurring frames / mental models they reach for
- Vocabulary or shorthand they repeat
- Tensions or tradeoffs they keep circling
- How they like to argue (examples, abstractions, pushback)

Keep under ~1200 characters. If prior profile is empty, infer from newUserTexts alone.`;

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

  const { previousProfile, newUserTexts } = parsed.data;
  const joined = newUserTexts.map((t, i) => `--- user ${i + 1} ---\n${t}`).join("\n\n");

  try {
    const t0 = performance.now();
    const result = await generateText({
      model: TOPIC_EXPLORE_THOUGHT_MODEL,
      system: SYSTEM,
      prompt: `PRIOR_PROFILE:\n${previousProfile?.trim() || "(none)"}\n\nNEW_USER_ONLY:\n${joined}`,
      maxOutputTokens: 700,
      providerOptions: TOPIC_EXPLORE_PROVIDER_OPTIONS,
    });
    const durationMs = performance.now() - t0;

    recordLlmCall({
      model: TOPIC_EXPLORE_THOUGHT_MODEL,
      usage: result.usage,
      durationMs,
      metadata: { operation: "topicExploreThoughtProfile", contextId: sbUserId },
    });

    const text = (result.text ?? "").trim();

    return Response.json({ profile: text });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "thought_profile_failed";

    logger.error("POST", msg);

    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
