import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { z } from "zod";

import { getSupabaseUserId } from "@/data/supabase/profiles";
import {
  listQuarantineEntries,
  listSourceReputations,
  reviewQuarantineEntry,
} from "@/lib/security/dmz";
import { applyApprovedQuarantineEntry } from "@/lib/security/dmz/apply";

export async function GET(req: Request) {
  const user = await auth();

  if (!user?.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sbUserId = await getSupabaseUserId(user.userId);

  if (sbUserId.error || !sbUserId.data) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const url = new URL(req.url);
  const subjectKey = url.searchParams.get("subjectKey") ?? undefined;
  const status = url.searchParams.get("status") as
    | "pending"
    | "approved"
    | "rejected"
    | "blocked"
    | undefined;

  const entries = listQuarantineEntries(sbUserId.data, {
    subjectKey,
    status: status ?? undefined,
  });

  return NextResponse.json({
    entries: entries.map((e) => ({
      id: e.id,
      provider: e.provider,
      subjectKey: e.subjectKey,
      status: e.status,
      createdAt: e.createdAt,
      reviewedAt: e.reviewedAt,
      findings: e.scan.findings,
      intakeSummary: e.intakeSummary,
      clipboardMeta: e.clipboardMeta,
      memoryIds: e.memoryIds,
    })),
    reputations: listSourceReputations(sbUserId.data),
  });
}

const ReviewSchema = z.object({
  entryId: z.string().uuid(),
  action: z.enum(["approve", "reject"]),
  note: z.string().max(2000).optional(),
});

export async function POST(req: Request) {
  const user = await auth();

  if (!user?.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sbUserId = await getSupabaseUserId(user.userId);

  if (sbUserId.error || !sbUserId.data) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  let json: unknown;

  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const parsed = ReviewSchema.safeParse(json);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const result = reviewQuarantineEntry({
    userId: sbUserId.data,
    entryId: parsed.data.entryId,
    action: parsed.data.action,
    note: parsed.data.note,
  });

  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  if (parsed.data.action === "approve") {
    result.memoryIds = await applyApprovedQuarantineEntry(sbUserId.data, result);
  }

  return NextResponse.json({
    entry: {
      id: result.id,
      status: result.status,
      reviewedAt: result.reviewedAt,
      intakeSummary: result.intakeSummary,
      memoryIds: result.memoryIds,
    },
  });
}
