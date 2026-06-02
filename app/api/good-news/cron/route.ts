import { timingSafeEqual } from "crypto";

import { NextResponse } from "next/server";

import { upsertDigest } from "@/data/supabase/good-news";
import { createLogger } from "@/lib/logger";
import { runGoodNewsPipeline } from "@/lib/good-news/pipeline";

const logger = createLogger("app/api/good-news/cron/route.ts");

// Verification + multi-source fact-checking is slow; give it ample headroom.
// Note: long runs may require Vercel Pro / fluid compute.
export const maxDuration = 300;
export const dynamic = "force-dynamic";

/**
 * Authorize the request. Vercel Cron sends `Authorization: Bearer ${CRON_SECRET}`
 * when CRON_SECRET is set as an env var. We also accept the same bearer for manual
 * triggers. If no secret is configured, the endpoint is closed.
 */
/** Constant-time string compare; false (no early-out) when lengths differ. */
function safeEqual(a: string, b: string): boolean {
  const encoder = new TextEncoder();
  const aBytes = encoder.encode(a);
  const bBytes = encoder.encode(b);

  if (aBytes.length !== bBytes.length) return false;

  return timingSafeEqual(aBytes, bBytes);
}

function isAuthorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;

  if (!secret) return false;

  const header = req.headers.get("authorization");

  if (!header) return false;

  return safeEqual(header, `Bearer ${secret}`);
}

async function handle(req: Request) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const digest = await runGoodNewsPipeline();
    const { error } = await upsertDigest(digest);

    if (error) {
      logger.error("handle", `Failed to persist digest: ${error.message}`);

      return NextResponse.json({ error: "Failed to persist digest" }, { status: 500 });
    }

    logger.log("handle", `Digest stored for ${digest.date} with ${digest.items.length} items`);

    return NextResponse.json({
      ok: true,
      date: digest.date,
      itemCount: digest.items.length,
      meta: digest.meta ?? {},
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);

    logger.error("handle", `Pipeline error: ${message}`);

    return NextResponse.json({ error: "Pipeline failed" }, { status: 500 });
  }
}

export async function GET(req: Request) {
  return handle(req);
}

export async function POST(req: Request) {
  return handle(req);
}
