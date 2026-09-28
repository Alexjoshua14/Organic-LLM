import "server-only";

import type { Result } from "@/types";

import { auth } from "@clerk/nextjs/server";

import { getSupabaseUserId } from "@/data/supabase/profiles";
import {
  deleteFeedbackRow,
  getFeedbackRow,
  listFeedbackRows,
  updateFeedbackNote,
  updateFeedbackMemory,
  upsertFeedbackVote,
} from "@/data/supabase/memory-feedback";
import { getMemoriesOwnershipSnapshotForUser } from "@/lib/memory/operations";
import {
  createFeedbackService,
  decodeFeedbackRow,
  FEEDBACK_CONFLICT,
  FEEDBACK_MEMORY_CHANGED,
  FEEDBACK_MEMORY_UNAVAILABLE,
  FEEDBACK_MEMORY_TOO_LONG,
} from "@/lib/memory/feedback-service";
import { checkMemoryFeedbackLimit } from "@/lib/rate-limit/memory";

export async function resolveFeedbackUser(): Promise<string | null> {
  const { userId } = await auth();

  if (!userId) return null;
  const profile = await getSupabaseUserId(userId);

  return profile.error ? null : profile.data;
}

export const feedbackService = createFeedbackService(
  {
    get: getFeedbackRow,
    upsertVote: upsertFeedbackVote,
    updateNote: updateFeedbackNote,
    updateMemory: updateFeedbackMemory,
    remove: deleteFeedbackRow,
  },
  async (userId, memoryId) => {
    const snapshot = await getMemoriesOwnershipSnapshotForUser(userId);

    if (snapshot.error) throw new Error("Could not read memories");

    return snapshot.data?.results.find((memory) => memory.id === memoryId)?.memory ?? null;
  }
);

export async function withFeedbackUser<T>(
  operation: (userId: string) => Promise<T>
): Promise<Result<T, string>> {
  try {
    const userId = await resolveFeedbackUser();

    if (!userId) return { data: null, error: "Not signed in" };
    const limit = await checkMemoryFeedbackLimit(userId);

    if (!limit.success) return { data: null, error: "Please wait before updating feedback again." };

    return { data: await operation(userId), error: null };
  } catch (error) {
    // Database/crypto/provider errors can contain submitted text. Never return or log them.
    return {
      data: null,
      error:
        error instanceof Error &&
        [
          FEEDBACK_CONFLICT,
          FEEDBACK_MEMORY_CHANGED,
          FEEDBACK_MEMORY_UNAVAILABLE,
          FEEDBACK_MEMORY_TOO_LONG,
        ].includes(error.message)
          ? error.message
          : "Could not update feedback. Please try again.",
    };
  }
}

export async function readFeedback(userId: string, memoryId: string) {
  const row = await getFeedbackRow(userId, memoryId);

  return row ? decodeFeedbackRow(row) : null;
}

export async function listFeedback(userId: string, offset: number, limit: number) {
  const { rows, hasMore } = await listFeedbackRows(userId, offset, limit);

  return { rows: rows.map((row) => decodeFeedbackRow(row)), hasMore };
}
