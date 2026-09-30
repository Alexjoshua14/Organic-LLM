import "server-only";

import {
  getMessageEncryptionService,
  parseEncryptedPayload,
  type MessageEncryptionService,
} from "@/lib/crypto/message-encryption";

function context(userId: string, memoryId: string) {
  return { userId, threadId: memoryId, fieldName: "memory_feedback.note" as const };
}

export function encryptFeedbackNote(
  note: string,
  userId: string,
  memoryId: string,
  service: MessageEncryptionService = getMessageEncryptionService()
): string {
  return service.encryptForStorage(note, context(userId, memoryId));
}

export function decryptFeedbackNote(
  ciphertext: string,
  userId: string,
  memoryId: string,
  service: MessageEncryptionService = getMessageEncryptionService()
): string {
  // Feedback has no legacy plaintext path: an old automatic flag is not an approved note.
  if (!parseEncryptedPayload(ciphertext)) throw new Error("Feedback note is not encrypted");

  return service.decryptFromStorage(ciphertext, context(userId, memoryId));
}

export function encryptFeedbackMemory(
  memory: string,
  userId: string,
  memoryId: string,
  service: MessageEncryptionService = getMessageEncryptionService()
): string {
  return service.encryptForStorage(memory, {
    userId,
    threadId: memoryId,
    fieldName: "memory_feedback.memory",
  });
}

export function decryptFeedbackMemory(
  ciphertext: string,
  userId: string,
  memoryId: string,
  service: MessageEncryptionService = getMessageEncryptionService()
): string {
  if (!parseEncryptedPayload(ciphertext)) throw new Error("Shared memory is not encrypted");

  return service.decryptFromStorage(ciphertext, {
    userId,
    threadId: memoryId,
    fieldName: "memory_feedback.memory",
  });
}
