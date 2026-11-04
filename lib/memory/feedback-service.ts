import "server-only";

import type { StoredFeedback } from "@/data/supabase/memory-feedback";
import type { MessageEncryptionService } from "@/lib/crypto/message-encryption";
import type {
  MemoryFeedbackRow,
  RecordMemoryFeedbackInput,
  FeedbackMutationInput,
} from "@/lib/schemas/memory-quality";

import {
  encryptFeedbackNote,
  decryptFeedbackNote,
  encryptFeedbackMemory,
  decryptFeedbackMemory,
} from "@/lib/crypto/memory-feedback-encryption";
import {
  FeedbackMutationInputSchema,
  FeedbackNoteInputSchema,
  RecordMemoryFeedbackInputSchema,
  ShareFeedbackMemoryInputSchema,
  SharedFeedbackMemoryTextSchema,
} from "@/lib/schemas/memory-quality";

export const FEEDBACK_CONFLICT = "Feedback changed. Reopen it to review the current version.";
export const FEEDBACK_MEMORY_CHANGED = "This memory changed. Preview it again before sharing.";
export const FEEDBACK_MEMORY_UNAVAILABLE = "This memory is no longer available to share.";
export const FEEDBACK_MEMORY_TOO_LONG =
  "This memory is too long to share. You can share a note instead.";

export function decodeFeedbackRow(
  row: StoredFeedback,
  crypto?: MessageEncryptionService
): MemoryFeedbackRow {
  const { note_ciphertext, memory_ciphertext, ...rest } = row;

  return {
    ...rest,
    note:
      note_ciphertext && row.note_approved_at
        ? decryptFeedbackNote(note_ciphertext, row.user_id, row.memory_id, crypto)
        : null,
    shared_memory:
      memory_ciphertext && row.memory_shared_at
        ? decryptFeedbackMemory(memory_ciphertext, row.user_id, row.memory_id, crypto)
        : null,
  };
}

type FeedbackRepository = {
  get: (userId: string, memoryId: string) => Promise<StoredFeedback | null>;
  upsertVote: (userId: string, input: RecordMemoryFeedbackInput) => Promise<StoredFeedback>;
  updateNote: (
    userId: string,
    input: FeedbackMutationInput,
    ciphertext: string | null
  ) => Promise<StoredFeedback | null>;
  remove: (userId: string, input: FeedbackMutationInput) => Promise<boolean>;
  updateMemory: (
    userId: string,
    input: FeedbackMutationInput,
    ciphertext: string | null
  ) => Promise<StoredFeedback | null>;
};

/** Identity is resolved by the server entry point; the drafting agent has no access to this service. */
export function createFeedbackService(
  repository: FeedbackRepository,
  getOwnedMemoryText: (userId: string, memoryId: string) => Promise<string | null>,
  crypto?: MessageEncryptionService
) {
  async function previewMemory(userId: string, input: unknown) {
    const parsed = FeedbackMutationInputSchema.parse(input);
    const row = await repository.get(userId, parsed.memoryId);

    if (!row || row.id !== parsed.feedbackId || row.revision !== parsed.revision)
      throw new Error(FEEDBACK_CONFLICT);
    const memoryText = await getOwnedMemoryText(userId, parsed.memoryId);

    if (!memoryText) throw new Error(FEEDBACK_MEMORY_UNAVAILABLE);
    if (!SharedFeedbackMemoryTextSchema.safeParse(memoryText).success)
      throw new Error(FEEDBACK_MEMORY_TOO_LONG);

    return { memoryText };
  }

  return {
    previewMemory,
    async vote(userId: string, input: unknown) {
      const parsed = RecordMemoryFeedbackInputSchema.parse(input);

      if ((await getOwnedMemoryText(userId, parsed.memoryId)) === null)
        throw new Error("Memory not found");

      return decodeFeedbackRow(await repository.upsertVote(userId, parsed), crypto);
    },
    async approveNote(userId: string, input: unknown) {
      const parsed = FeedbackNoteInputSchema.parse(input);
      const ciphertext = encryptFeedbackNote(parsed.note, userId, parsed.memoryId, crypto);
      const row = await repository.updateNote(userId, parsed, ciphertext);

      if (!row) throw new Error(FEEDBACK_CONFLICT);

      return decodeFeedbackRow(row, crypto);
    },
    async removeNote(userId: string, input: unknown) {
      const parsed = FeedbackMutationInputSchema.parse(input);
      const row = await repository.updateNote(userId, parsed, null);

      if (!row) throw new Error(FEEDBACK_CONFLICT);

      return decodeFeedbackRow(row, crypto);
    },
    async shareMemory(userId: string, input: unknown) {
      const parsed = ShareFeedbackMemoryInputSchema.parse(input);
      const { memoryText } = await previewMemory(userId, {
        feedbackId: parsed.feedbackId,
        memoryId: parsed.memoryId,
        revision: parsed.revision,
      });

      // Re-read from the owner's memory store. Only the exact text they reviewed may be saved.
      if (memoryText !== parsed.memoryText) throw new Error(FEEDBACK_MEMORY_CHANGED);
      const ciphertext = encryptFeedbackMemory(memoryText, userId, parsed.memoryId, crypto);
      const row = await repository.updateMemory(userId, parsed, ciphertext);

      if (!row) throw new Error(FEEDBACK_CONFLICT);

      return decodeFeedbackRow(row, crypto);
    },
    async removeSharedMemory(userId: string, input: unknown) {
      const parsed = FeedbackMutationInputSchema.parse(input);
      const row = await repository.updateMemory(userId, parsed, null);

      if (!row) throw new Error(FEEDBACK_CONFLICT);

      return decodeFeedbackRow(row, crypto);
    },
    async remove(userId: string, input: unknown) {
      const parsed = FeedbackMutationInputSchema.parse(input);

      if (!(await repository.remove(userId, parsed))) throw new Error(FEEDBACK_CONFLICT);

      return true as const;
    },
  };
}
