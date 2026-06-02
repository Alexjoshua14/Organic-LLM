import "server-only";

/**
 * Memory store — low-level, server-only. No auth, no rate limits.
 * Expects Mem0 user id (Supabase id). Only operations.ts (and tests) should
 * import and call these functions. See lib/memory/README.md for contract.
 */

import { Message, SearchMemoryOptions, SearchResult } from "mem0ai/oss";
import { UIMessage } from "@ai-sdk/react";

import { convertUIMessageToMem0Message } from "../chat/message-transform";

import { getMemory } from "./client";

import { createLogger } from "@/lib/logger";
import { isRedactPIIInMemoryEnabled, redactPII, redactUIMessages } from "@/lib/pii/redact";

const logger = createLogger("lib/memory/store.ts");

const NO_CHAT_ID_PLACEHOLDER = "no-chat-id" as const;

/** Mem0 OSS getAll defaults to limit 100; raise so UI and ownership checks see more rows. */
export const MEM0_GET_ALL_LIMIT = 2000;

/**
 * Searches for memories based on a query. Low-level: expects Mem0 user id
 * (Supabase user id in this app), not Clerk id.
 * By default grabs top 3 relevant memories.
 * On Qdrant/mem0 failure, throws a simple Error so callers can return Result.
 */
export async function searchMemories(
  query: string,
  userId: string,
  options?: SearchMemoryOptions
): Promise<SearchResult> {
  if (!userId) {
    throw new Error("User ID is required");
  }

  try {
    const memory = getMemory();

    logger.log("searchMemories", `Searching for memories: ${query}`);
    const result = await memory.search(query, {
      userId,
      limit: options?.limit ?? 3,
      ...options,
    });

    logger.log("searchMemories", `Found ${result.results?.length} memories`);

    return result;
  } catch {
    logger.warn("searchMemories", "Memory search failed (service unavailable).");
    throw new Error("Memory service may be unavailable.");
  }
}

/**
 * Fetches all memories for a user. Low-level: expects Mem0 user id
 * (Supabase user id in this app), not Clerk id.
 * On Qdrant/mem0 failure, throws a simple Error so callers can return Result.
 */
export async function getAllMemories(userId: string): Promise<SearchResult> {
  if (!userId) {
    throw new Error("User ID is required");
  }

  try {
    const memory = getMemory();
    const result: SearchResult = await memory.getAll({
      userId,
      limit: MEM0_GET_ALL_LIMIT,
    });

    return result;
  } catch {
    logger.warn("getAllMemories", "Memory fetch failed (service unavailable).");
    throw new Error("Memory service may be unavailable.");
  }
}

/**
 * Adds the latest messages to memory. Low-level: expects Mem0 user id
 * (Supabase user id in this app). Should only contain new messages.
 */
export async function addLatestMessagesToMemory(
  messages: UIMessage[],
  userId: string,
  chatId?: string
): Promise<SearchResult> {
  if (!userId) {
    throw new Error("User ID is required");
  }

  const memory = getMemory();

  logger.log("addLatestMessagesToMemory", `Adding ${messages.length} messages to memory`);

  const messagesToStore = isRedactPIIInMemoryEnabled()
    ? (redactUIMessages(messages as Parameters<typeof redactUIMessages>[0]) as UIMessage[])
    : messages;
  const interactions: Message[] = messagesToStore.map((m) =>
    convertUIMessageToMem0Message(m, chatId ?? NO_CHAT_ID_PLACEHOLDER)
  );

  const result = await memory.add(interactions, {
    userId,
  });

  logger.log("addLatestMessagesToMemory", `Added ${result.results?.length} messages to memory`);
  // Do not log result.results in production; it may contain message content.
  logger.debug("addLatestMessagesToMemory", "Mem0 add results", result.results?.length ?? 0);

  return result;
}

/**
 * Adds an interaction to memory. Low-level: expects Mem0 user id
 * (Supabase user id in this app). Should be latest user message and AI response.
 */
export async function addInteractionToMemory(
  userQuery: string,
  aiResponse: string,
  userId: string
): Promise<SearchResult> {
  if (!userId) {
    throw new Error("User ID is required");
  }
  logger.log("addInteractionToMemory", `Adding interaction to memory`);

  const memory = getMemory();

  const safeUserQuery = isRedactPIIInMemoryEnabled() ? redactPII(userQuery) : userQuery;
  const safeAiResponse = isRedactPIIInMemoryEnabled() ? redactPII(aiResponse) : aiResponse;

  let result: SearchResult;

  try {
    const interaction: Message[] = [
      {
        role: "user",
        content: safeUserQuery,
      },
      {
        role: "assistant",
        content: safeAiResponse,
      },
    ];

    result = await memory.add(interaction, {
      userId,
    });
    logger.log("addInteractionToMemory", `Added interaction to memory`);
    logger.log("addInteractionToMemory", `Results: ${JSON.stringify(result.results)}`);
  } catch (error) {
    logger.error("addInteractionToMemory", "Error adding interaction to memory:", error);

    return {
      results: [],
      relations: [],
    };
  }

  return result;
}

/**
 * Adds explicit Mem0 `Message[]` for a user (intentional writes, e.g. Delphi `commit_memory`).
 * Low-level: no auth, no rate limits. Callers must pass a server-resolved Mem0 user id.
 */
export async function addMemory(
  messages: Message[],
  userId: string,
  options: {
    metadata?: Record<string, unknown>;
    infer?: boolean;
  }
): Promise<SearchResult> {
  if (!userId) {
    throw new Error("User ID is required");
  }

  const memory = getMemory();

  const messagesToStore: Message[] = messages.map((m) => {
    if (typeof m.content !== "string") {
      return m;
    }
    const content = isRedactPIIInMemoryEnabled() ? redactPII(m.content) : m.content;

    return { role: m.role, content };
  });

  logger.log("addMemory", `Adding ${messagesToStore.length} message(s) to memory (infer=${options.infer ?? true})`);

  const result = await memory.add(messagesToStore, {
    userId,
    metadata: options.metadata,
    infer: options.infer ?? true,
  });

  logger.debug("addMemory", "Mem0 add results", result.results?.length ?? 0);

  return result;
}

/**
 * Wipes all memories for a user. Low-level: expects Mem0 user id
 * (Supabase user id in this app). If exposing from UI, use a
 * wipeMemoryForCurrentUser() wrapper that resolves the current user server-side.
 */
export async function wipeMemory(userId: string): Promise<boolean> {
  if (!userId) {
    throw new Error("User ID is required");
  }

  try {
    const memory = getMemory();

    await memory.deleteAll({ userId });
    logger.log("wipeMemory", "Memory wiped successfully");
  } catch (error) {
    logger.error("wipeMemory", "Error wiping memory:", error);

    return false;
  }

  return true;
}

/**
 * Deletes a memory from the database. Low-level: no auth or ownership check.
 * Callers must pass a Mem0 user id (Supabase id in this app). Prefer
 * deleteMemoryForCurrentUser for UI-facing deletes.
 */
export async function deleteMemory(memoryId: string): Promise<boolean> {
  const memory = getMemory();

  if (!memoryId) {
    throw new Error("Memory ID is required");
  }

  try {
    await memory.delete(memoryId);
  } catch (error) {
    logger.error("deleteMemory", "Error deleting memory:", error);

    return false;
  }

  return true;
}
