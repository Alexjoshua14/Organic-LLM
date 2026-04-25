import { randomUUID } from "crypto";

import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

import { getStrataPageById } from "@/data/supabase/strata";
import { getSupabaseUserId } from "@/data/supabase/profiles";
import { searchWeb } from "@/lib/exa/client";
import { createLogger } from "@/lib/logger";
import { checkStrataIngestLimit } from "@/lib/rate-limit/strata-ingest";
import { StrataIngestRequestSchema, type StrataTextSourceNode } from "@/lib/schemas/strata";
import { sanitizeRawUserInput } from "@/lib/strata/input-safety";
import { fetchUrlCommitViaExa, fetchUrlPreviewViaExa } from "@/lib/strata/fetch-url-exa";
import { assertSafePublicHttpsUrl } from "@/lib/strata/safe-url";

export const maxDuration = 30;

const logger = createLogger("app/api/prototypes/strata/ingest/route.ts");

export async function POST(req: Request) {
  const clerkUser = await auth();

  if (!clerkUser?.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sbUserIdResult = await getSupabaseUserId(clerkUser.userId);

  if (sbUserIdResult.error || sbUserIdResult.data === null) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }
  const sbUserId = sbUserIdResult.data;

  let bodyJson: unknown;

  try {
    bodyJson = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = StrataIngestRequestSchema.safeParse(bodyJson);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { pageId } = parsed.data;

  const limitResult = await checkStrataIngestLimit(sbUserId, pageId);

  if (!limitResult.success) {
    return NextResponse.json({ error: limitResult.error ?? "Too many requests" }, { status: 429 });
  }

  const pageBundle = await getStrataPageById(pageId);

  if (!pageBundle || pageBundle.page.owner_id !== sbUserId) {
    return NextResponse.json({ error: "Strata page not found" }, { status: 404 });
  }

  const op = parsed.data.op;

  try {
    if (op === "search") {
      const { query } = parsed.data;
      const { sources, error } = await searchWeb(query, { numResults: 8, type: "auto" });

      if (error) {
        logger.log("ingest", `search error: ${error.message}`);
      }

      return NextResponse.json({
        ok: true as const,
        op: "search" as const,
        results: sources.map((s) => ({
          title: s.title,
          url: s.url,
          snippet: s.snippet ?? "",
        })),
      });
    }

    if (op === "url_preview") {
      const { url } = parsed.data;
      const safe = assertSafePublicHttpsUrl(url);

      if (!safe.ok) {
        return NextResponse.json({ ok: false, error: safe.reason }, { status: 400 });
      }
      const fetched = await fetchUrlPreviewViaExa(url);

      if (!fetched.ok) {
        return NextResponse.json({ ok: false, error: fetched.error }, { status: 422 });
      }

      return NextResponse.json({
        ok: true as const,
        op: "url_preview" as const,
        previewText: fetched.text,
        suggestedTitle: fetched.titleHint,
        canonicalUrl: safe.href,
      });
    }

    if (op === "url_commit") {
      const { url, title } = parsed.data;
      const safe = assertSafePublicHttpsUrl(url);

      if (!safe.ok) {
        return NextResponse.json({ ok: false, error: safe.reason }, { status: 400 });
      }
      const fetched = await fetchUrlCommitViaExa(url);

      if (!fetched.ok) {
        return NextResponse.json({ ok: false, error: fetched.error }, { status: 422 });
      }
      const body = sanitizeRawUserInput(fetched.text);
      const node: StrataTextSourceNode = {
        id: randomUUID(),
        kind: "url",
        title: (title?.trim() || fetched.titleHint).slice(0, 512),
        body,
        createdAt: new Date().toISOString(),
        meta: { url: safe.href },
      };

      return NextResponse.json({ ok: true as const, op: "url_commit" as const, node });
    }

    if (op === "append_text") {
      const { title, body, kind } = parsed.data;
      const safeBody = sanitizeRawUserInput(body);
      const node: StrataTextSourceNode = {
        id: randomUUID(),
        kind,
        title: title.trim().slice(0, 512) || "Untitled",
        body: safeBody,
        createdAt: new Date().toISOString(),
      };

      return NextResponse.json({ ok: true as const, op: "append_text" as const, node });
    }
  } catch (err) {
    const e = err instanceof Error ? err : new Error(String(err));

    logger.error("ingest", e.message);

    return NextResponse.json({ error: "Ingest failed" }, { status: 500 });
  }

  return NextResponse.json({ error: "Unsupported op" }, { status: 400 });
}
