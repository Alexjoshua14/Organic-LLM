import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

import { getSupabaseUserIdCached } from "@/data/supabase/profile-id-cache";
import { getSidebarThreadsPage } from "@/data/supabase/sidebar-threads";
import {
  clampSidebarPageSize,
  decodeSidebarCursor,
  parseSidebarScope,
} from "@/lib/chat/sidebar-threads";
import { createLogger } from "@/lib/logger";
import { checkChatsListLimit } from "@/lib/rate-limit/chats";

const logger = createLogger("app/api/chats/route.ts");

/** `Server-Timing` entries, in ms, so DevTools and logs show where the budget went. */
function serverTiming(marks: Record<string, number>): string {
  return Object.entries(marks)
    .map(([name, ms]) => `${name};dur=${ms.toFixed(1)}`)
    .join(", ");
}

/**
 * GET /api/chats?scope=main|all&cursor=&limit=
 *
 * One page of the authenticated user's sidebar threads, newest first. The first page
 * (no cursor) also carries every pinned thread. `scope=all` is coalescence mode.
 * Rate-limited (240/hour per user). Protected by Clerk (401 when unauthenticated)
 * and by explicit owner_id filtering as a defense-in-depth safeguard alongside RLS.
 * See docs/thread-session-architecture.md for API and cache contract.
 */
export async function GET(request: Request) {
  const start = performance.now();
  const { userId } = await auth();
  const afterAuth = performance.now();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const params = new URL(request.url).searchParams;
  const rawCursor = params.get("cursor");
  const cursor = decodeSidebarCursor(rawCursor);

  if (rawCursor && !cursor) {
    return NextResponse.json({ error: "Invalid cursor" }, { status: 400 });
  }

  // Independent hops: run the limiter and the owner lookup together.
  const [rateLimitResult, sbUserIdResult] = await Promise.all([
    checkChatsListLimit(userId),
    getSupabaseUserIdCached(userId),
  ]);
  const afterGate = performance.now();

  if (!rateLimitResult.success) {
    return NextResponse.json(
      { error: rateLimitResult.error ?? "Too many requests" },
      { status: 429 }
    );
  }

  if (sbUserIdResult.error || sbUserIdResult.data === null) {
    logger.error("GET", "Supabase user not found for Clerk user");

    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const result = await getSidebarThreadsPage({
    ownerId: sbUserIdResult.data,
    scope: parseSidebarScope(params.get("scope")),
    cursor,
    limit: clampSidebarPageSize(params.get("limit")),
  });
  const end = performance.now();
  const timing = serverTiming({
    auth: afterAuth - start,
    gate: afterGate - afterAuth,
    db: end - afterGate,
    total: end - start,
  });

  if (result.error || !result.data) {
    logger.error("GET", "Failed to fetch chats");

    return NextResponse.json(
      { error: "Failed to fetch chats" },
      { status: 500, headers: { "Server-Timing": timing } }
    );
  }

  return NextResponse.json(result.data, {
    headers: { "Server-Timing": timing, "Cache-Control": "private, no-store" },
  });
}
