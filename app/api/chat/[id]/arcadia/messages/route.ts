import { NextResponse } from "next/server";

import { readThreadMessagesWithAdmin } from "@/data/supabase/subagent-threads";
import { requireOwnedThread } from "@/lib/api/require-owned-thread";

/** Recent persisted background replies for the thread currently on screen. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const gate = await requireOwnedThread(id);

  if (!gate.ok) return gate.response;
  const messages = await readThreadMessagesWithAdmin({
    threadId: id,
    ownerId: gate.actor.sbUserId,
    limit: 60,
  });

  return NextResponse.json({ messages }, { headers: { "Cache-Control": "no-store" } });
}
