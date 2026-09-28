import { describe, expect, mock, test } from "bun:test";

import { createMessageEncryptionService } from "@/lib/crypto/message-encryption";
import {
  encryptFeedbackNote,
  decryptFeedbackNote,
  encryptFeedbackMemory,
  decryptFeedbackMemory,
} from "@/lib/crypto/memory-feedback-encryption";
import {
  createFeedbackService,
  decodeFeedbackRow,
  FEEDBACK_CONFLICT,
  FEEDBACK_MEMORY_CHANGED,
  FEEDBACK_MEMORY_UNAVAILABLE,
} from "@/lib/memory/feedback-service";
import { gatherFeedbackContext } from "@/lib/memory/feedback-context";
import type { StoredFeedback } from "@/data/supabase/memory-feedback";

const crypto = createMessageEncryptionService({
  activeKeyId: "k1",
  keyRegistry: { k1: "test-feedback-only-root-secret" },
});
const base: StoredFeedback = {
  id: "dbe604d1-0f68-4b49-b8af-1979b454e6b8",
  user_id: "owner",
  memory_id: "memory-a",
  signal: "up",
  source: "memory_lens",
  note_ciphertext: null,
  note_approved_at: null,
  memory_ciphertext: null,
  memory_shared_at: null,
  revision: 1,
  created_at: "2026-09-23T00:00:00Z",
  updated_at: "2026-09-23T00:00:00Z",
};
const mutation = { feedbackId: base.id, memoryId: base.memory_id, revision: 1 };

function setup(ownsMemory = true) {
  let stored = { ...base };
  let memoryText: string | null = ownsMemory ? "Exact memory text" : null;
  const repository = {
    get: mock(async (userId: string, memoryId: string) =>
      userId === stored.user_id && memoryId === stored.memory_id ? stored : null
    ),
    upsertVote: mock(async () => stored),
    updateNote: mock(async (userId: string, input: typeof mutation, ciphertext: string | null) => {
      if (
        userId !== stored.user_id ||
        input.feedbackId !== stored.id ||
        input.memoryId !== stored.memory_id ||
        input.revision !== stored.revision
      )
        return null;
      stored = {
        ...stored,
        revision: stored.revision + 1,
        note_ciphertext: ciphertext,
        note_approved_at: ciphertext ? base.created_at : null,
      };

      return stored;
    }),
    remove: mock(
      async (userId: string, input: typeof mutation) =>
        userId === stored.user_id &&
        input.feedbackId === stored.id &&
        input.revision === stored.revision
    ),
    updateMemory: mock(
      async (userId: string, input: typeof mutation, ciphertext: string | null) => {
        if (
          userId !== stored.user_id ||
          input.feedbackId !== stored.id ||
          input.memoryId !== stored.memory_id ||
          input.revision !== stored.revision
        )
          return null;
        stored = {
          ...stored,
          revision: stored.revision + 1,
          memory_ciphertext: ciphertext,
          memory_shared_at: ciphertext ? base.created_at : null,
        };

        return stored;
      }
    ),
  };

  return {
    repository,
    service: createFeedbackService(repository, async () => memoryText, crypto),
    stored: () => stored,
    setMemory: (text: string | null) => {
      memoryText = text;
    },
  };
}

describe("approved memory feedback", () => {
  test("encrypts with fresh IVs and binds ciphertext to user, memory and field", () => {
    const first = encryptFeedbackNote("Helpful detail", "owner", "memory-a", crypto);
    const second = encryptFeedbackNote("Helpful detail", "owner", "memory-a", crypto);

    expect(first).not.toBe(second);
    expect(first).not.toContain("Helpful detail");
    expect(decryptFeedbackNote(first, "owner", "memory-a", crypto)).toBe("Helpful detail");
    expect(() => decryptFeedbackNote(first, "someone-else", "memory-a", crypto)).toThrow();
    expect(() => decryptFeedbackNote(first, "owner", "memory-b", crypto)).toThrow();
    expect(() =>
      crypto.decryptFromStorage(first, {
        userId: "owner",
        threadId: "memory-a",
        fieldName: "messages.content",
      })
    ).toThrow();
    expect(() => decryptFeedbackNote("old unapproved flag", "owner", "memory-a", crypto)).toThrow();
  });

  test("no note can be submitted through the vote endpoint", async () => {
    const { service, repository } = setup();

    await expect(
      service.vote("owner", {
        memoryId: "memory-a",
        signal: "up",
        source: "memory_lens",
        note: "not approved",
      })
    ).rejects.toThrow();
    expect(repository.upsertVote).not.toHaveBeenCalled();
  });

  test("votes require actual memory ownership", async () => {
    const { service, repository } = setup(false);

    await expect(
      service.vote("owner", { memoryId: "foreign-memory", signal: "down", source: "memory_lens" })
    ).rejects.toThrow("Memory not found");
    expect(repository.upsertVote).not.toHaveBeenCalled();
  });

  test("approval is required and only ciphertext reaches persistence", async () => {
    const { service, repository, stored } = setup();

    await expect(service.approveNote("owner", { ...mutation, note: "Useful" })).rejects.toThrow();
    await expect(
      service.approveNote("owner", { ...mutation, note: "Useful", approved: false })
    ).rejects.toThrow();
    expect(repository.updateNote).not.toHaveBeenCalled();
    const saved = await service.approveNote("owner", {
      ...mutation,
      note: "Useful",
      approved: true,
    });

    expect(saved.note).toBe("Useful");
    expect(stored().note_ciphertext).toStartWith("enc:v1:");
    expect(JSON.stringify(stored())).not.toContain("Useful");
    expect(saved).not.toHaveProperty("note_ciphertext");
    expect(saved.shared_memory).toBeNull();
    expect(repository.updateMemory).not.toHaveBeenCalled();
  });

  test("edited notes and feedback remain removable after the memory is deleted", async () => {
    const { service, stored } = setup(false);
    const saved = await service.approveNote("owner", {
      ...mutation,
      note: "First approved note",
      approved: true,
    });
    const edited = await service.approveNote("owner", {
      ...mutation,
      revision: saved.revision,
      note: "Replacement",
      approved: true,
    });

    expect(edited.note).toBe("Replacement");
    expect(decodeFeedbackRow(stored(), crypto).note).toBe("Replacement");
    const cleared = await service.removeNote("owner", { ...mutation, revision: edited.revision });

    expect(cleared.note).toBeNull();
    expect(stored().note_ciphertext).toBeNull();
    expect(stored().note_approved_at).toBeNull();
    expect(await service.remove("owner", { ...mutation, revision: cleared.revision })).toBe(true);
  });

  test("foreign users and stale edits cannot replace or remove a note", async () => {
    const { service } = setup();
    const input = { ...mutation, note: "Approved", approved: true };

    await expect(service.approveNote("someone-else", input)).rejects.toThrow(FEEDBACK_CONFLICT);
    await service.approveNote("owner", input);
    await expect(service.approveNote("owner", input)).rejects.toThrow(FEEDBACK_CONFLICT);
    await expect(service.removeNote("owner", mutation)).rejects.toThrow(FEEDBACK_CONFLICT);
    await expect(service.remove("owner", mutation)).rejects.toThrow(FEEDBACK_CONFLICT);
  });
});

describe("explicit memory sharing", () => {
  test("preview and votes never persist memory content", async () => {
    const { service, repository, stored } = setup();

    await service.vote("owner", { memoryId: base.memory_id, signal: "up", source: "memory_lens" });
    expect(await service.previewMemory("owner", mutation)).toEqual({
      memoryText: "Exact memory text",
    });
    expect(repository.updateMemory).not.toHaveBeenCalled();
    expect(stored().memory_ciphertext).toBeNull();
    await expect(
      service.vote("owner", {
        memoryId: base.memory_id,
        signal: "up",
        source: "memory_lens",
        memoryText: "Exact memory text",
      })
    ).rejects.toThrow();
  });

  test("requires explicit approval and persists only the exact encrypted copy", async () => {
    const { service, repository, stored, setMemory } = setup();
    const memoryText = "  Exact memory\nwith whitespace  ";

    setMemory(memoryText);
    await expect(service.shareMemory("owner", { ...mutation, memoryText })).rejects.toThrow();
    await expect(
      service.shareMemory("owner", { ...mutation, memoryText, approved: false })
    ).rejects.toThrow();
    expect(repository.updateMemory).not.toHaveBeenCalled();
    const saved = await service.shareMemory("owner", { ...mutation, memoryText, approved: true });

    expect(saved.shared_memory).toBe(memoryText);
    expect(saved.note).toBeNull();
    expect(stored().memory_ciphertext).toStartWith("enc:v1:");
    expect(JSON.stringify(stored())).not.toContain(memoryText);
    expect(saved).not.toHaveProperty("memory_ciphertext");
  });

  test("rejects stale, foreign, forged, changed, and deleted memory approvals", async () => {
    const { service, repository, setMemory } = setup();
    const input = { ...mutation, memoryText: "Exact memory text", approved: true };

    await expect(service.previewMemory("someone-else", mutation)).rejects.toThrow(
      FEEDBACK_CONFLICT
    );
    await expect(service.shareMemory("someone-else", input)).rejects.toThrow(FEEDBACK_CONFLICT);
    await expect(service.shareMemory("owner", { ...input, revision: 9 })).rejects.toThrow(
      FEEDBACK_CONFLICT
    );
    await expect(
      service.shareMemory("owner", { ...input, memoryText: "Forged content" })
    ).rejects.toThrow(FEEDBACK_MEMORY_CHANGED);
    setMemory("Changed since the preview");
    await expect(service.shareMemory("owner", input)).rejects.toThrow(FEEDBACK_MEMORY_CHANGED);
    setMemory(null);
    await expect(service.shareMemory("owner", input)).rejects.toThrow(FEEDBACK_MEMORY_UNAVAILABLE);
    expect(repository.updateMemory).not.toHaveBeenCalled();
  });

  test("a memory copy is removable after original deletion without changing the note or vote", async () => {
    const { service, stored, setMemory } = setup();
    const note = await service.approveNote("owner", {
      ...mutation,
      note: "Helpful",
      approved: true,
    });
    const shared = await service.shareMemory("owner", {
      ...mutation,
      revision: note.revision,
      memoryText: "Exact memory text",
      approved: true,
    });

    setMemory(null);
    expect(decodeFeedbackRow(stored(), crypto).shared_memory).toBe("Exact memory text");
    await expect(
      service.removeSharedMemory("someone-else", { ...mutation, revision: shared.revision })
    ).rejects.toThrow(FEEDBACK_CONFLICT);
    await expect(service.removeSharedMemory("owner", mutation)).rejects.toThrow(FEEDBACK_CONFLICT);
    const removed = await service.removeSharedMemory("owner", {
      ...mutation,
      revision: shared.revision,
    });

    expect(removed.shared_memory).toBeNull();
    expect(stored().memory_ciphertext).toBeNull();
    expect(stored().memory_shared_at).toBeNull();
    expect(removed.note).toBe("Helpful");
    expect(removed.signal).toBe("up");
  });

  test("encrypted copies cannot be substituted between users, memories, or notes", () => {
    const encrypted = encryptFeedbackMemory("Private memory", "owner", "memory-a", crypto);

    expect(decryptFeedbackMemory(encrypted, "owner", "memory-a", crypto)).toBe("Private memory");
    expect(() => decryptFeedbackMemory(encrypted, "other", "memory-a", crypto)).toThrow();
    expect(() => decryptFeedbackMemory(encrypted, "owner", "memory-b", crypto)).toThrow();
    expect(() => decryptFeedbackNote(encrypted, "owner", "memory-a", crypto)).toThrow();
    expect(() => decryptFeedbackMemory("unencrypted", "owner", "memory-a", crypto)).toThrow();
    expect(
      decodeFeedbackRow({ ...base, memory_ciphertext: encrypted }, crypto).shared_memory
    ).toBeNull();
  });
});

describe("feedback drafting context", () => {
  test("reads memories for the resolved user, and rejects a foreign chat reference", async () => {
    const memories = mock(async () => [
      { id: "memory-a", memory: "Preferred green tea", metadata: { chat_id: "foreign-thread" } },
      { id: "memory-b", memory: "Prefers black coffee" },
    ]);
    const messages = mock(async () => []);
    const context = await gatherFeedbackContext("owner", "memory-a", "tea", {
      memories,
      messages,
      threadOwner: async () => "someone-else",
    });

    expect(memories).toHaveBeenCalledWith("owner");
    expect(messages).not.toHaveBeenCalled();
    expect(context.recentChat).toEqual([]);
  });

  test("includes bounded context from an owned chat and never imports tool messages", async () => {
    const context = await gatherFeedbackContext("owner", "memory-a", "remembered", {
      memories: async () => [
        { id: "memory-a", memory: "Remembered preference", metadata: { chat_id: "own-thread" } },
        ...Array.from({ length: 10 }, (_, index) => ({
          id: `related-${index}`,
          memory: `Remembered ${"x".repeat(2000)}`,
        })),
      ],
      threadOwner: async () => "owner",
      messages: async () => [
        { id: "chat-message", role: "user", parts: [{ type: "text", text: "Context" }] },
      ],
    });

    expect(context.relatedMemories).toHaveLength(5);
    expect(context.relatedMemories.every((memory) => memory.length <= 1500)).toBe(true);
    expect(context.recentChat).toEqual([{ role: "user", text: "Context" }]);
  });

  test("a deleted memory does not cause an unrelated chat to be read", async () => {
    const threadOwner = mock(async () => "owner");
    const context = await gatherFeedbackContext("owner", "deleted", "feedback", {
      memories: async () => [],
      messages: async () => [],
      threadOwner,
    });

    expect(context.memory).toBeNull();
    expect(threadOwner).not.toHaveBeenCalled();
  });
});
