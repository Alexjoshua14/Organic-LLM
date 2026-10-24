import { auth } from "@clerk/nextjs/server";
import { z } from "zod";

import { getSupabaseUserId } from "@/data/supabase/profiles";
import { HomepageRoutePreviewSchema } from "@/lib/homepage/ollama-schemas";
import { createLogger } from "@/lib/logger";
import { ollamaChatJson } from "@/lib/ollama/client";
import { checkHomepageOllamaLimit } from "@/lib/rate-limit/homepage-ollama";

const logger = createLogger("api/homepage/route-preview");

const BodySchema = z.object({
  text: z.string().max(24_000),
});

const MAX_PROMPT_CHARS = 4_000;

const SYSTEM = `You classify a short user message into one intent for app routing.
Reply with ONLY a JSON object (no markdown) with keys:
- intent: one of "new_chat", "continue_thread", "rabbit_hole", "strata", "settings", "other"
- confidence: number 0 to 1
- label: short human-readable summary (max 12 words)

Definitions:
- new_chat: user wants a fresh conversation
- continue_thread: user seems to continue an existing topic (guess if ambiguous)
- rabbit_hole: exploratory deep-dive / research tree
- strata: long-form document / notes / workspace page
- settings: preferences, account, configuration
- other: does not fit above`;

function parsePreviewJson(raw: string) {
  try {
    return HomepageRoutePreviewSchema.parse(JSON.parse(raw));
  } catch {
    const m = raw.match(/\{[\s\S]*\}/);

    if (m) {
      return HomepageRoutePreviewSchema.parse(JSON.parse(m[0]));
    }

    throw new Error("Invalid preview JSON");
  }
}

export const maxDuration = 30;

export async function POST(req: Request) {
  const clerkUser = await auth();

  if (!clerkUser?.userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sbUserIdResult = await getSupabaseUserId(clerkUser.userId);

  if (sbUserIdResult.error || sbUserIdResult.data === null) {
    return Response.json({ error: "User not found" }, { status: 404 });
  }

  const sbUserId = sbUserIdResult.data;
  const limit = await checkHomepageOllamaLimit(sbUserId);

  if (!limit.success) {
    return Response.json(
      { error: "Rate limited", retryAfterSec: limit.retryAfterSec ?? 15 },
      { status: 429 }
    );
  }

  let body: z.infer<typeof BodySchema>;

  try {
    body = BodySchema.parse(await req.json());
  } catch {
    return Response.json({ error: "Invalid body" }, { status: 400 });
  }

  const text = body.text.trim().slice(0, MAX_PROMPT_CHARS);

  if (!text) {
    return Response.json({ error: "Empty text" }, { status: 400 });
  }

  try {
    const raw = await ollamaChatJson({
      system: SYSTEM,
      user: text,
    });
    const preview = parsePreviewJson(raw);

    return Response.json({ preview });
  } catch (e) {
    logger.error("POST", String(e));

    return Response.json({ error: "Preview failed" }, { status: 502 });
  }
}
