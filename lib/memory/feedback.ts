import "server-only";

import { insertMemoryFeedbackRow } from "@/data/supabase/memory-quality";
import { auth } from "@clerk/nextjs/server";

import { getSupabaseUserId } from "@/data/supabase/profiles";
import { getAllMemories as storeGetAllMemories } from "@/lib/memory/store";
import { recordMemoryEvent } from "@/lib/memory/quality-events";
import type {
  MemoryFeedbackSignal,
  RecordMemoryFeedbackInput,
} from "@/lib/schemas/memory-quality";
import { RecordMemoryFeedbackInputSchema } from "@/lib/schemas/memory-quality";
import { Result } from "@/types";

async function resolveCurrentUserId(): Promise<Result<string, string>> {
  const { userId: clerkUserId } = await auth();

  if (!clerkUserId) {
    return { data: null, error: "Not signed in" };
  }

  const sbResult = await getSupabaseUserId(clerkUserId);

  if (sbResult.error || !sbResult.data) {
    return { data: null, error: "User profile not found" };
  }

  return { data: sbResult.data, error: null };
}

async function verifyMemoryOwnership(
  userId: string,
  memoryId: string
): Promise<boolean> {
  try {
    const owned = await storeGetAllMemories(userId);

    return owned.results?.some((m) => m.id === memoryId) ?? false;
  } catch {
    return false;
  }
}

export async function recordMemoryFeedbackForUser(
  userId: string,
  input: RecordMemoryFeedbackInput
): Promise<Result<boolean, string>> {
  const parsed = RecordMemoryFeedbackInputSchema.safeParse(input);

  if (!parsed.success) {
    return { data: null, error: "Invalid feedback input" };
  }

  const { memoryId, signal, source, chatId, note } = parsed.data;

  const owned = await verifyMemoryOwnership(userId, memoryId);

  if (!owned) {
    return { data: null, error: "Memory not found" };
  }

  const insertResult = await insertMemoryFeedbackRow({
    userId,
    memoryId,
    signal,
    source,
    chatId,
    note,
  });

  if (!insertResult.ok) {
    return { data: null, error: insertResult.error ?? "Failed to save feedback" };
  }

  await recordMemoryEvent({
    userId,
    event: "feedback",
    source: "unknown",
    memoryId,
    metadata: { signal, feedbackSource: source },
  });

  return { data: true, error: null };
}

export async function recordMemoryFeedbackForCurrentUser(
  input: RecordMemoryFeedbackInput
): Promise<Result<boolean, string>> {
  const userResult = await resolveCurrentUserId();

  if (userResult.error || !userResult.data) {
    return { data: null, error: userResult.error ?? "Not signed in" };
  }

  return recordMemoryFeedbackForUser(userResult.data, input);
}

export async function recordDelphiFlagFeedback(args: {
  userId: string;
  chatId: string;
  signal: Extract<MemoryFeedbackSignal, "flag_review" | "flag_followup">;
  note?: string;
  memoryId?: string;
}): Promise<Result<boolean, string>> {
  const memoryId = args.memoryId?.trim() || `chat:${args.chatId}`;

  const insertResult = await insertMemoryFeedbackRow({
    userId: args.userId,
    memoryId,
    signal: args.signal,
    source: "delphi_tool",
    chatId: args.chatId,
    note: args.note,
  });

  if (!insertResult.ok) {
    return { data: null, error: insertResult.error ?? "Failed to save flag" };
  }

  await recordMemoryEvent({
    userId: args.userId,
    event: "feedback",
    source: "delphi",
    memoryId: args.memoryId,
    metadata: { signal: args.signal },
  });

  return { data: true, error: null };
}
