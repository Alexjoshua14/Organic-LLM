import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { z } from "zod";

import { getSupabaseUserId } from "@/data/supabase/profiles";
import { undoDmzIntake } from "@/lib/security/dmz/apply";

const UndoSchema = z.object({
  entryId: z.string().uuid(),
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
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = UndoSchema.safeParse(json);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const result = await undoDmzIntake(sbUserId.data, parsed.data.entryId);

  if (result.error || !result.data) {
    return NextResponse.json({ error: result.error ?? "Undo failed" }, { status: 400 });
  }

  return NextResponse.json({
    ok: true,
    deletedMemoryIds: result.data.deletedMemoryIds,
  });
}
