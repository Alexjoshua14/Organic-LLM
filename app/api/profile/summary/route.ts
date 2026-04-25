import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

import { getSupabaseUserId } from "@/data/supabase/profiles";
import {
  generateProfileFromMemory,
  ProfileGenerationRequestSchema,
} from "@/lib/profile-generation";
import { checkProfileTreeGenerationLimit } from "@/lib/rate-limit/profile";

/**
 * Generates and persists a memory-only ProfileTree for the signed-in settings profile.
 * Kept at /api/profile/summary for compatibility with the existing client path.
 */
export async function POST(req: Request) {
  const user = await auth();

  if (!user?.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const limit = await checkProfileTreeGenerationLimit(user.userId);

  if (!limit.success) {
    return NextResponse.json({ error: limit.error ?? "Too many requests" }, { status: 429 });
  }

  const sbUserId = await getSupabaseUserId(user.userId);

  if (sbUserId.error || !sbUserId.data) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  let body;

  try {
    body = ProfileGenerationRequestSchema.parse(await req.json().catch(() => ({})));
  } catch {
    return NextResponse.json({ error: "Invalid profile generation request" }, { status: 400 });
  }

  const result = await generateProfileFromMemory({
    userId: sbUserId.data,
    displayName: body.displayName ?? "User",
    email: body.email ?? "",
  });

  if (!result.ok) {
    return NextResponse.json(
      {
        error: result.error,
        ...(result.data ?? {}),
      },
      { status: result.status }
    );
  }

  return NextResponse.json({
    data: result.data.tree,
    revisionId: result.data.revisionId,
    revisionStatus: result.data.revisionStatus,
    reviewScore: result.data.reviewScore,
    warnings: result.data.warnings,
    budget: result.data.budget,
  });
}
