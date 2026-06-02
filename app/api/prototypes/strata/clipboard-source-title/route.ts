import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

import { getStrataPageById } from "@/data/supabase/strata";
import { getSupabaseUserId } from "@/data/supabase/profiles";
import { generateStrataClipboardSourceTitle } from "@/lib/llm/strata-clipboard-source-title";
import { createLogger } from "@/lib/logger";
import { checkStrataClipboardSourceTitleLimit } from "@/lib/rate-limit/title";
import { StrataClipboardSourceTitleBodySchema } from "@/lib/schemas/strata";

export const maxDuration = 20;

const logger = createLogger("app/api/prototypes/strata/clipboard-source-title/route.ts");

function isLocalStrataPageId(id: string): boolean {
  return id.startsWith("local-");
}

/**
 * POST /api/prototypes/strata/clipboard-source-title
 *
 * Suggests a short title for pasted source text using GPT‑5 Nano with ZDR gateway options.
 */
export async function POST(req: Request) {
  const clerkUser = await auth();

  if (!clerkUser?.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sbUserIdResult = await getSupabaseUserId(clerkUser.userId);

  if (sbUserIdResult.error || sbUserIdResult.data === null) {
    logger.error("POST", "Supabase user not found for Clerk user");

    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const sbUserId = sbUserIdResult.data;

  let json: unknown;

  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = StrataClipboardSourceTitleBodySchema.safeParse(json);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { pageId, excerpt } = parsed.data;

  if (!isLocalStrataPageId(pageId)) {
    const pageBundle = await getStrataPageById(pageId);

    if (!pageBundle || pageBundle.page.owner_id !== sbUserId) {
      return NextResponse.json({ error: "Strata page not found" }, { status: 404 });
    }
  }

  const limitResult = await checkStrataClipboardSourceTitleLimit(sbUserId, pageId);

  if (!limitResult.success) {
    return NextResponse.json({ error: limitResult.error ?? "Too many requests" }, { status: 429 });
  }

  const titleResult = await generateStrataClipboardSourceTitle({
    excerpt,
    contextId: pageId,
  });

  if (titleResult.error || titleResult.data == null) {
    logger.error("POST", "Clipboard source title generation failed");

    return NextResponse.json(
      { error: titleResult.error?.message ?? "Failed to generate title" },
      { status: 500 }
    );
  }

  return NextResponse.json({ title: titleResult.data });
}
