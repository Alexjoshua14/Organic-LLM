import { generateText } from "ai";
import z from "zod";

import { requireLlmChatActor } from "@/lib/api/chat-llm-gate";
import { getChats } from "@/data/supabase/chat";
import { searchMemoriesForUser } from "@/lib/memory/operations";
import {
  parseJsonObjectFromLlmText,
  TOPIC_EXPLORE_PROVIDER_OPTIONS,
  TOPIC_EXPLORE_STARTERS_MODEL,
} from "@/lib/sandbox/topic-explore-llm";
import { recordLlmCall } from "@/lib/llm/metrics";
import { createLogger } from "@/lib/logger";

export const maxDuration = 30;

const logger = createLogger("app/api/sandbox/topic-explore/starters/route.ts");

const BodySchema = z.object({
  excludeThreadId: z.string().uuid().optional(),
});

const STARTERS_SYSTEM = `You help generate cold-start exploration prompts for a chat product called Noesis.

You will receive (1) bullet lines from the user's memory corpus and (2) recent thread cards (title, feature, updated time).

Output **only** valid JSON (no markdown fences) with this exact shape:
{
  "digest": string (150–280 tokens: active tensions, recurring curiosities, 3–5 thread lines framed as hypotheses; question-shaped not biography),
  "sparks": [string, string, string, string]
}

Rules for sparks:
- Exactly 4 strings; each spark is one short line the user could tap to start chatting (no numbering prefix).
- Spark 1–2: grounded in **memories** (paraphrase; never paste sensitive-looking verbatim PII).
- Spark 3: grounded in **recent threads** (unresolved angle / recurring theme).
- Spark 4: **neutral wildcard** — domain-agnostic provocation that stays interesting even if memory/thread context were weak.
- Use exploration verbs: push, revisit, challenge, reframe, pressure-test, unpack — never imperative product tasks like "write", "build", "do a PR".
- Keep each spark under 140 characters when possible.`;

export async function POST(req: Request) {
  const gate = await requireLlmChatActor();

  if (gate.error != null) return gate.error;

  const { sbUserId } = gate.data!;

  let body: z.infer<typeof BodySchema> = {};

  try {
    const json = await req.json();
    const parsed = BodySchema.safeParse(json);

    if (parsed.success) body = parsed.data;
  } catch {
    // empty body ok
  }

  const memRes = await searchMemoriesForUser(
    sbUserId,
    "What is this user wrestling with lately? Open decisions, recurring themes, tensions, and curiosities.",
    { limit: 8 }
  );

  const memoryLines =
    memRes.error || !memRes.data?.results?.length
      ? "(no memory hits)"
      : memRes.data.results
          .map((r) => {
            const m = typeof r.memory === "string" ? r.memory : "";
            const line = m.replace(/\s+/g, " ").trim().slice(0, 220);

            return line ? `- ${line}` : null;
          })
          .filter(Boolean)
          .join("\n");

  const chatsRes = await getChats({ ownerId: sbUserId });
  const threads = (chatsRes.data ?? [])
    .filter((t) => (body.excludeThreadId ? t.id !== body.excludeThreadId : true))
    .slice(0, 14);

  const threadLines =
    threads.length === 0
      ? "(no threads)"
      : threads
          .map((t) => {
            const title = (t.title ?? "Untitled").replace(/\s+/g, " ").trim().slice(0, 80);
            const row = t as { feature?: string | null; path?: string | null };
            const feat = row.feature?.trim() || "main";

            return `- ${title} · ${feat} · ${t.updated_at ?? ""}`;
          })
          .join("\n");

  const userBlock = `MEMORY_LINES:\n${memoryLines}\n\nRECENT_THREADS:\n${threadLines}`;

  try {
    const t0 = performance.now();
    const result = await generateText({
      model: TOPIC_EXPLORE_STARTERS_MODEL,
      system: STARTERS_SYSTEM,
      prompt: userBlock,
      maxOutputTokens: 900,
      providerOptions: TOPIC_EXPLORE_PROVIDER_OPTIONS,
    });
    const durationMs = performance.now() - t0;

    recordLlmCall({
      model: TOPIC_EXPLORE_STARTERS_MODEL,
      usage: result.usage,
      durationMs,
      metadata: { operation: "topicExploreStarters", contextId: sbUserId },
    });

    const obj = parseJsonObjectFromLlmText(result.text ?? "");
    const sparksRaw = obj?.sparks;
    const digest = typeof obj?.digest === "string" ? obj.digest.trim() : "";

    const sparks = Array.isArray(sparksRaw)
      ? sparksRaw
          .filter((s): s is string => typeof s === "string")
          .map((s) => s.replace(/^\s*\d+[.)]\s*/, "").trim())
          .filter(Boolean)
          .slice(0, 4)
      : [];

    while (sparks.length < 4) {
      sparks.push("Name a belief you've softened on recently — and what changed your mind.");
    }

    return Response.json({
      digest: digest || null,
      sparks: sparks.slice(0, 4),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "starters_failed";

    logger.error("POST", msg);

    return Response.json(
      {
        digest: null,
        sparks: [
          "What tension in your current work deserves a harder look?",
          "Revisit an idea you abandoned too early — what would convince you to try again?",
          "What are you optimizing for this week that might be the wrong objective?",
          "Name a belief you've softened on recently — and what changed your mind.",
        ],
      },
      { status: 200 }
    );
  }
}
