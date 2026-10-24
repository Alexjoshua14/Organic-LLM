import { NextResponse } from "next/server";
import { z } from "zod";

import { createSupabaseResearchLedgerStore } from "@/data/supabase/research-ledger";
import { requireOwnedThread } from "@/lib/api/require-owned-thread";
import { readResearchSource } from "@/lib/llm/subagents/research/presentation";

const QuerySchema = z.object({
  offset: z.coerce.number().int().min(0).max(80_000).default(0),
  limit: z.coerce.number().int().min(1).max(12_000).default(12_000),
  page: z.coerce.number().int().min(1).max(2_000).optional(),
});
const headers = { "Cache-Control": "private, no-store" };

/** Read an owned, captured snapshot. Never refetches the original website or spends a provider call. */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string; sourceId: string }> }
) {
  const { id, sourceId } = await params;

  if (!z.string().uuid().safeParse(id).success || !/^src-[a-f0-9-]{36}$/.test(sourceId))
    return NextResponse.json({ error: "Invalid source request." }, { status: 400, headers });
  const gate = await requireOwnedThread(id);

  if (!gate.ok) return gate.response;
  const query = QuerySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));

  if (!query.success)
    return NextResponse.json({ error: "Invalid source range." }, { status: 400, headers });
  try {
    const state = await createSupabaseResearchLedgerStore({
      threadId: id,
      ownerId: gate.actor.sbUserId,
    }).load();

    if (!state)
      return NextResponse.json(
        { error: "Saved research is unavailable. Try again later." },
        { status: 503, headers }
      );
    const slice = readResearchSource(state.ledger, { sourceId, ...query.data });

    return NextResponse.json(slice, { status: "error" in slice ? 404 : 200, headers });
  } catch {
    return NextResponse.json(
      { error: "Could not read this saved source." },
      { status: 503, headers }
    );
  }
}
