import "server-only";

import type { Result } from "@/types";

import { supabaseServer } from "@/lib/supabase/server";

/** Fresh RLS-scoped stream marker. Resuming never needs message content or decryption. */
export async function readThreadStreamState(
  threadId: string
): Promise<Result<{ activeStreamId: string | null }>> {
  const sb = await supabaseServer();
  const { data, error } = await sb
    .from("threads")
    .select("active_stream_id")
    .eq("id", threadId)
    .single();

  if (error || !data) {
    return { data: null, error: new Error(error?.message ?? "Thread unavailable") };
  }

  return { data: { activeStreamId: data.active_stream_id ?? null }, error: null };
}
