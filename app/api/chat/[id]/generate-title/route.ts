import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { z } from "zod";

import { getSupabaseUserId } from "@/data/supabase/profiles";
import { clientErrorJson, logRouteError } from "@/lib/api/client-safe-error";
import { generateChatTitle } from "@/lib/llm/chat-helpers";
import { createLogger } from "@/lib/logger";
import { checkTitleGenerationLimit } from "@/lib/rate-limit/title";
import { requirePlanBudget } from "@/lib/api/plan-budget-gate";

export const maxDuration = 30;

const logger = createLogger("app/api/chat/[id]/generate-title/route.ts");

const GenerateTitleBodySchema = z
  .object({
    experimentalKnowledgeCapsuleTitles: z.boolean().optional(),
  })
  .passthrough();

/**
 * POST /api/chat/[id]/generate-title
 *
 * Generates an AI title for the given chat. Requires auth; RLS restricts to owner's threads.
 * Optional body `{ experimentalKnowledgeCapsuleTitles: true }` selects the beta capsule pipeline.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const clerkUser = await auth();

  if (!clerkUser?.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sbUserIdResult = await getSupabaseUserId(clerkUser.userId);

  if (sbUserIdResult.error || sbUserIdResult.data === null) {
    logger.error("POST", "Supabase user not found for Clerk user");

    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const { id } = await params;
  const sbUserId = sbUserIdResult.data;
  const planGate = await requirePlanBudget({ clerkUserId: clerkUser.userId, sbUserId });

  if (planGate) return planGate;

  const limitResult = await checkTitleGenerationLimit(sbUserId, id);

  if (!limitResult.success) {
    return NextResponse.json({ error: limitResult.error ?? "Too many requests" }, { status: 429 });
  }

  let knowledgeCapsule = false;

  try {
    const bodyJson: unknown = await req.json();
    const parsed = GenerateTitleBodySchema.safeParse(bodyJson);
    if (parsed.success) {
      knowledgeCapsule = parsed.data.experimentalKnowledgeCapsuleTitles === true;
    }
  } catch {
    // Empty / non-JSON body is fine — legacy clients send POST with no body.
  }

  const result = await generateChatTitle(id, { knowledgeCapsule });

  if (result.error) {
    const message = result.error.message ?? "Failed to generate title";
    const isNoMessages = message.toLowerCase().includes("no messages");

    if (isNoMessages) {
      return NextResponse.json({ error: message }, { status: 400 });
    }

    logRouteError(logger, "POST", result.error);

    return clientErrorJson(500);
  }

  return NextResponse.json({
    data: result.data ?? "Chat",
  });
}
