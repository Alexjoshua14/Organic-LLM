import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import z from "zod";

import {
  listCoreInputSnapshots,
  upsertCoreInputSnapshots,
} from "@/data/supabase/core-input-snapshots";
import { getSupabaseUserId } from "@/data/supabase/profiles";
import { decodeSnapshot } from "@/lib/core-input/snapshot-codec";
import { SNAPSHOT_PUSH_BATCH_MAX } from "@/lib/core-input/snapshot-store";

const PushSchema = z.object({
  rows: z
    .array(
      z.object({
        scopeKey: z.string().min(1).max(200),
        value: z
          .number()
          .int()
          .refine((value) => decodeSnapshot(value) !== null, "Unrecognized snapshot"),
        updatedAt: z.number().int().positive(),
      })
    )
    .max(SNAPSHOT_PUSH_BATCH_MAX),
});

/**
 * Settings sync never calls a model, so it skips `requireLlmChatActor`: that gate would
 * spend the user's LLM message limit on every sync.
 */
async function resolveOwner(): Promise<string | NextResponse> {
  const clerkUser = await auth();

  if (!clerkUser?.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sbUserId = await getSupabaseUserId(clerkUser.userId);

  if (sbUserId.error || sbUserId.data === null) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  return sbUserId.data;
}

const TABLE_MISSING = { error: "Snapshot sync unavailable", available: false };

/** GET /api/core-input/snapshots — every snapshot for the signed-in user, newest first. */
export async function GET() {
  const owner = await resolveOwner();

  if (owner instanceof NextResponse) return owner;

  const result = await listCoreInputSnapshots(owner);

  if (result.status === "missing") return NextResponse.json(TABLE_MISSING, { status: 503 });
  if (result.status === "error") {
    return NextResponse.json({ error: "Failed to load snapshots" }, { status: 500 });
  }

  return NextResponse.json({ rows: result.data });
}

/** POST /api/core-input/snapshots — upserts changed snapshots (last write wins). */
export async function POST(req: Request) {
  const owner = await resolveOwner();

  if (owner instanceof NextResponse) return owner;

  let json: unknown;

  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = PushSchema.safeParse(json);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const result = await upsertCoreInputSnapshots(owner, parsed.data.rows);

  if (result.status === "missing") return NextResponse.json(TABLE_MISSING, { status: 503 });
  if (result.status === "error") {
    return NextResponse.json({ error: "Failed to save snapshots" }, { status: 500 });
  }

  return NextResponse.json({ accepted: result.data.accepted });
}
