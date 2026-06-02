import { auth } from "@clerk/nextjs/server";
import { revalidateTag } from "next/cache";
import { NextResponse } from "next/server";

import { getStrataPageById, renameStrataPage } from "@/data/supabase/strata";
import { getSupabaseUserId } from "@/data/supabase/profiles";
import { generateStrataPageTitleFromSections } from "@/lib/llm/strata-title";
import { createLogger } from "@/lib/logger";
import { checkStrataTitleGenerationLimit } from "@/lib/rate-limit/title";
import { StrataGenerateTitleRequestSchema, isUntitledStrataTitle } from "@/lib/schemas/strata";

export const maxDuration = 30;

const logger = createLogger("app/api/prototypes/strata/[id]/generate-title/route.ts");

function isLocalStrataPageId(id: string): boolean {
  return id.startsWith("local-");
}

/**
 * POST /api/prototypes/strata/[id]/generate-title
 *
 * AI title for a Strata page (same short-title stack as chat). DB-backed pages are renamed when untitled.
 * Local pages (`local-*`) require `sectionsSnapshot` in the JSON body.
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

  const { id: pageId } = await params;
  const sbUserId = sbUserIdResult.data;

  const limitResult = await checkStrataTitleGenerationLimit(sbUserId, pageId);

  if (!limitResult.success) {
    return NextResponse.json({ error: limitResult.error ?? "Too many requests" }, { status: 429 });
  }

  let bodyJson: unknown;

  try {
    bodyJson = await req.json();
  } catch {
    bodyJson = {};
  }

  const parsedBody = StrataGenerateTitleRequestSchema.safeParse(bodyJson);

  if (!parsedBody.success) {
    return NextResponse.json(
      { error: "Invalid request", details: parsedBody.error.flatten() },
      { status: 400 }
    );
  }

  const {
    sectionsSnapshot,
    refinedGeneratedTitle: bodyRefinedTitle,
    applyToDatabase,
  } = parsedBody.data;
  const localId = isLocalStrataPageId(pageId);

  const pageBundle = localId ? null : await getStrataPageById(pageId);

  if (!localId) {
    if (!pageBundle) {
      return NextResponse.json({ error: "Strata page not found" }, { status: 404 });
    }
    if (pageBundle.page.owner_id !== sbUserId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (!isUntitledStrataTitle(pageBundle.page.title)) {
      return NextResponse.json({ error: "Page already has a title" }, { status: 400 });
    }
  } else if (!sectionsSnapshot) {
    return NextResponse.json(
      { error: "sectionsSnapshot is required for local Strata pages" },
      { status: 400 }
    );
  }

  let rawText: string;
  let refinedText: string;
  let refinedGeneratedTitle: string | null | undefined;

  if (sectionsSnapshot) {
    rawText = sectionsSnapshot.raw_text;
    refinedText = sectionsSnapshot.refined_text;
    refinedGeneratedTitle = bodyRefinedTitle ?? null;
  } else if (pageBundle) {
    rawText = pageBundle.sections.raw_text.content;
    refinedText = pageBundle.sections.refined_text.content;
    refinedGeneratedTitle =
      (pageBundle.sections.refined_text.contentJson as { generatedTitle?: string } | null)
        ?.generatedTitle ?? null;
  } else {
    return NextResponse.json({ error: "No section content available" }, { status: 400 });
  }

  const titleResult = await generateStrataPageTitleFromSections({
    pageId,
    rawText,
    refinedText,
    refinedGeneratedTitle,
  });

  if (titleResult.error || titleResult.data == null) {
    const message = titleResult.error?.message ?? "Failed to generate Strata title";

    logger.error("POST", "Strata title generation failed");

    return NextResponse.json({ error: message }, { status: 500 });
  }

  const finalTitle = titleResult.data.trim().slice(0, 255) || "Strata";

  if (pageBundle && !localId && applyToDatabase) {
    await renameStrataPage(pageId, finalTitle);
    revalidateTag(`strata-pages:${pageBundle.page.owner_id}`, "max");
    revalidateTag(`strata-page:${pageId}`, "max");
  }

  return NextResponse.json({
    data: finalTitle,
  });
}
