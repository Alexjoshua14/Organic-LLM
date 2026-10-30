import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { z } from "zod";

import { getSupabaseUserIdCached } from "@/data/supabase/profile-id-cache";
import { cancelStageDesign } from "@/lib/stage/design";
import { readStage } from "@/lib/stage/store";
import { cancelStageSubagent } from "@/lib/stage/subagents";

export const maxDuration = 15;

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();

  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const owner = await getSupabaseUserIdCached(userId);

  if (!owner.data || owner.error)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  if (!z.string().uuid().safeParse(id).success)
    return NextResponse.json({ error: "Invalid specialist" }, { status: 400 });
  try {
    const current = await readStage(owner.data);
    const state =
      current.state.design?.id === id
        ? await cancelStageDesign(owner.data, id)
        : await cancelStageSubagent(owner.data, id);

    return NextResponse.json({ state }, { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return NextResponse.json(
      { error: "Couldn’t stop the specialist. Please try again." },
      { status: 500 }
    );
  }
}
