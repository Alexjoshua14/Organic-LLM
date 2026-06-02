import { auth } from "@clerk/nextjs/server";
import { z } from "zod";

import { getSupabaseUserId } from "@/data/supabase/profiles";
import {
  HomepagePlanIntentSchema,
  userTextContainsT3CodeToken,
} from "@/lib/homepage/ollama-schemas";
import { createLogger } from "@/lib/logger";
import { getOllamaPlanModel, ollamaChatJson } from "@/lib/ollama/client";
import { checkHomepageOllamaLimit } from "@/lib/rate-limit/homepage-ollama";

const logger = createLogger("api/homepage/plan-intent");

const BodySchema = z.object({
  text: z.string().max(24_000),
});

const MAX_PROMPT_CHARS = 8_000;

const SYSTEM = `You help plan the user's next step in Organic LLM. Reply with ONLY JSON (no markdown):
{
  "actions": array of actions (1-3 items),
  "t3codeSuggested": boolean
}

Each action is either:
{ "type": "new_chat", "rationale": "why" }
or
{ "type": "rabbit_hole", "seed": "suggested starting question", "rationale": "why" }

Set t3codeSuggested true only if the user's message is asking to consult internal T3 knowledge (they included the exact substring t3code in the message).

Prefer at least one action. Keep strings concise.`;

function parsePlanJson(raw: string) {
  try {
    return HomepagePlanIntentSchema.parse(JSON.parse(raw));
  } catch {
    const m = raw.match(/\{[\s\S]*\}/);

    if (m) {
      return HomepagePlanIntentSchema.parse(JSON.parse(m[0]));
    }

    throw new Error("Invalid plan JSON");
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
      model: getOllamaPlanModel(),
    });
    let plan = parsePlanJson(raw);

    if (userTextContainsT3CodeToken(text)) {
      plan = { ...plan, t3codeSuggested: true };
    }

    return Response.json({ plan });
  } catch (e) {
    logger.error("POST", String(e));

    return Response.json({ error: "Plan failed" }, { status: 502 });
  }
}
