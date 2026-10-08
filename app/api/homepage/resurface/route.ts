import type { ResurfaceResponse } from "@/lib/resurface/schema";

import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

import { getSupabaseUserId } from "@/data/supabase/profiles";
import { loadHomepageRoutingCandidates } from "@/lib/chat/load-homepage-routing-candidates";
import { createLogger } from "@/lib/logger";
import { getMemoriesOwnershipSnapshotForUser } from "@/lib/memory/operations";
import { checkHomepageResurfaceLimit } from "@/lib/rate-limit/homepage-resurface";
import { isSpeakRealtimeEnabled } from "@/lib/rate-limit/speak-realtime";
import {
  readResurfaceList,
  toCardRecords,
  toPublicCards,
  writeResurfaceList,
} from "@/lib/resurface/cache";
import { collectResurfaceCandidates } from "@/lib/resurface/candidates";
import { rankResurfaceCandidates } from "@/lib/resurface/rank";

export const maxDuration = 30;

const logger = createLogger("app/api/homepage/resurface/route.ts");

/**
 * GET /api/homepage/resurface — past thoughts for the homepage row, ordered by Jev (ZDR).
 *
 * The homepage calls this after first paint. A cached list answers immediately; a miss collects
 * the pool, ranks it, and caches the cards so the Speak mint can seed a call from one by id.
 * Logs carry counts only, never thought text.
 */
export async function GET() {
  const clerkUser = await auth();

  if (!clerkUser?.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sbUserIdResult = await getSupabaseUserId(clerkUser.userId);

  if (sbUserIdResult.error || !sbUserIdResult.data) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const ownerId = sbUserIdResult.data;
  const voiceEnabled = isSpeakRealtimeEnabled();
  const cached = await readResurfaceList(ownerId);

  if (cached) {
    return NextResponse.json({
      cards: toPublicCards(cached.cards),
      source: cached.source,
      voiceEnabled,
    } satisfies ResurfaceResponse);
  }

  const limit = await checkHomepageResurfaceLimit(ownerId);

  if (!limit.success) {
    return NextResponse.json(
      { error: "Rate limited", retryAfterSec: limit.retryAfterSec ?? 60 },
      { status: 429 }
    );
  }

  // The memory snapshot skips the memory list limit; the resurface limit above stands in for it.
  const candidates = await collectResurfaceCandidates(ownerId, {
    getMemories: getMemoriesOwnershipSnapshotForUser,
    loadRouted: loadHomepageRoutingCandidates,
  });
  const ranked = await rankResurfaceCandidates({ candidates });
  const cards = toCardRecords(ranked.cards);

  await writeResurfaceList(ownerId, { cards, source: ranked.source, createdAt: Date.now() });

  logger.log("GET", "Resurface row built", {
    candidates: candidates.length,
    cards: cards.length,
    source: ranked.source,
  });

  return NextResponse.json({
    cards: toPublicCards(cards),
    source: ranked.source,
    voiceEnabled,
  } satisfies ResurfaceResponse);
}
