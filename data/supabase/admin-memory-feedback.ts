import "server-only";

import { z } from "zod";

import { StoredFeedbackSchema } from "@/data/supabase/memory-feedback";
import { requireAdmin } from "@/lib/admin/require-admin";
import { decodeFeedbackRow } from "@/lib/memory/feedback-service";

/** Only explicitly shared content and vote totals reach the admin; no live memory/chat lookup. */
export async function readAdminMemoryFeedback(offset = 0) {
  if (!(await requireAdmin())) throw new Error("Forbidden");
  const { supabaseAdmin } = await import("@/lib/supabase/supabase-admin");
  const [page, up, down] = await Promise.all([
    supabaseAdmin
      .from("memory_feedback")
      .select("*")
      .order("created_at", { ascending: false })
      .order("id")
      .range(offset, offset + 20)
      .throwOnError(),
    supabaseAdmin
      .from("memory_feedback")
      .select("id", { count: "exact", head: true })
      .eq("signal", "up")
      .throwOnError(),
    supabaseAdmin
      .from("memory_feedback")
      .select("id", { count: "exact", head: true })
      .eq("signal", "down")
      .throwOnError(),
  ]);
  const rows = z.array(StoredFeedbackSchema).parse(page.data ?? []);

  return {
    rows: rows.slice(0, 20).map((stored) => {
      const {
        id,
        signal,
        source,
        note,
        note_approved_at,
        shared_memory,
        memory_shared_at,
        created_at,
        updated_at,
      } = decodeFeedbackRow(stored);

      return {
        id,
        signal,
        source,
        note,
        note_approved_at,
        shared_memory,
        memory_shared_at,
        created_at,
        updated_at,
      };
    }),
    hasMore: rows.length > 20,
    counts: { up: up.count ?? 0, down: down.count ?? 0 },
  };
}
