"use server";

import { deleteMemoryForCurrentUser } from "@/lib/memory/operations";

/**
 * Delphi "Undo" for a just-filed memory. A thin wrapper over
 * {@link deleteMemoryForCurrentUser}, which verifies the memory belongs to the
 * current user (and applies the delete rate limit) before removing it from Mem0.
 */
export async function forgetMemory(memoryId: string) {
  return deleteMemoryForCurrentUser(memoryId);
}
