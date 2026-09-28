import "server-only";

import { z } from "zod";

import {
  MemoryFeedbackRowSchema,
  type RecordMemoryFeedbackInput,
  type FeedbackMutationInput,
} from "@/lib/schemas/memory-quality";
import { supabaseServer } from "@/lib/supabase/server";

export const StoredFeedbackSchema = MemoryFeedbackRowSchema.omit({
  note: true,
  shared_memory: true,
}).extend({
  note_ciphertext: z.string().nullable(),
  memory_ciphertext: z.string().nullable(),
});
export type StoredFeedback = z.infer<typeof StoredFeedbackSchema>;

export async function getFeedbackRow(
  userId: string,
  memoryId: string
): Promise<StoredFeedback | null> {
  const sb = await supabaseServer();
  const { data } = await sb
    .from("memory_feedback")
    .select("*")
    .eq("user_id", userId)
    .eq("memory_id", memoryId)
    .maybeSingle()
    .throwOnError();

  return data ? StoredFeedbackSchema.parse(data) : null;
}

export async function listFeedbackRows(userId: string, offset: number, limit: number) {
  const sb = await supabaseServer();
  const { data } = await sb
    .from("memory_feedback")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .order("id")
    .range(offset, offset + limit)
    .throwOnError();
  const rows = z.array(StoredFeedbackSchema).parse(data ?? []);

  return { rows: rows.slice(0, limit), hasMore: rows.length > limit };
}

export async function upsertFeedbackVote(
  userId: string,
  input: RecordMemoryFeedbackInput
): Promise<StoredFeedback> {
  const sb = await supabaseServer();
  const { data } = await sb
    .from("memory_feedback")
    .upsert(
      {
        user_id: userId,
        memory_id: input.memoryId,
        signal: input.signal,
        source: input.source,
      },
      { onConflict: "user_id,memory_id" }
    )
    .select("*")
    .single()
    .throwOnError();

  // The database clears the note atomically when the vote changes.
  return StoredFeedbackSchema.parse(data);
}

export async function updateFeedbackNote(
  userId: string,
  input: FeedbackMutationInput,
  ciphertext: string | null
): Promise<StoredFeedback | null> {
  const sb = await supabaseServer();
  const { data } = await sb
    .from("memory_feedback")
    .update({ note_ciphertext: ciphertext })
    .eq("user_id", userId)
    .eq("memory_id", input.memoryId)
    .eq("id", input.feedbackId)
    .eq("revision", input.revision)
    .select("*")
    .maybeSingle()
    .throwOnError();

  return data ? StoredFeedbackSchema.parse(data) : null;
}

export async function deleteFeedbackRow(
  userId: string,
  input: FeedbackMutationInput
): Promise<boolean> {
  const sb = await supabaseServer();
  const { data } = await sb
    .from("memory_feedback")
    .delete()
    .eq("user_id", userId)
    .eq("memory_id", input.memoryId)
    .eq("id", input.feedbackId)
    .eq("revision", input.revision)
    .select("id")
    .maybeSingle()
    .throwOnError();

  return data !== null;
}

export async function updateFeedbackMemory(
  userId: string,
  input: FeedbackMutationInput,
  ciphertext: string | null
): Promise<StoredFeedback | null> {
  const sb = await supabaseServer();
  const { data } = await sb
    .from("memory_feedback")
    .update({ memory_ciphertext: ciphertext })
    .eq("user_id", userId)
    .eq("memory_id", input.memoryId)
    .eq("id", input.feedbackId)
    .eq("revision", input.revision)
    .select("*")
    .maybeSingle()
    .throwOnError();

  return data ? StoredFeedbackSchema.parse(data) : null;
}
