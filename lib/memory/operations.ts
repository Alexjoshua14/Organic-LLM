"use server";

import {
  MemoryItem,
  Message,
  SearchMemoryOptions,
  SearchResult,
} from "mem0ai/oss";
import { UIMessage } from "@ai-sdk/react";

import { getMemory } from "./client";

import { createLogger } from "@/lib/logger";
import { convertUIMessageToMem0Message } from "../chat/message-transform";
import { auth } from "@clerk/nextjs/server";
import { Result } from "@/types";

const logger = createLogger("lib/memory/operations.ts");

/**
 * Searches for memories based on a query.
 * By default grabs top 3 relevant memories.
 *
 * @param query - The query to search for
 * @param userId - The clerk ID of the user to search memories for
 * @param options - Optional search options
 * @returns - The search results
 */
export async function searchMemories(
  query: string,
  userId: string,
  options?: SearchMemoryOptions,
): Promise<SearchResult> {
  if (!userId) {
    throw new Error("User ID is required");
  }

  const memory = getMemory();

  logger.log("searchMemories", `Searching for memories: ${query}`);

  const result = await memory.search(query, {
    userId,
    limit: options?.limit ?? 3,
    ...options,
  });

  logger.log("searchMemories", `Found ${result.results?.length} memories`);

  return result;
}

// TODO: Ensure function is secure
export async function searchMemoriesServer(
  query: string,
  options?: SearchMemoryOptions,
): Promise<Result<SearchResult, string>> {
  const { userId } = await auth();

  if (!userId) {
    return {
      data: null,
      error: "User ID is required",
    };
  }

  const memory = getMemory();

  try {
    const result = await memory.search(query, {
      userId,
      limit: options?.limit ?? 3,
      ...options,
    });
    return {
      data: result,
      error: null,
    };
  } catch (error) {
    return {
      data: null,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Fetches all persisted memories for the current user (for Memory Lens UI).
 * Uses Clerk auth + Supabase profile to resolve user id for Mem0.
 */
export async function getCurrentUserMemories(): Promise<
  Result<SearchResult, string>
> {
  const { userId: clerkUserId } = await auth();
  if (!clerkUserId) {
    return { data: null, error: "Not signed in" };
  }

  const { getSupabaseUserId } = await import("@/data/supabase/profiles");
  const sbResult = await getSupabaseUserId(clerkUserId);
  if (sbResult.error || sbResult.data === null) {
    return { data: null, error: "User profile not found" };
  }

  try {
    const result = await getAllMemories(sbResult.data);
    return { data: result, error: null };
  } catch (error) {
    return {
      data: null,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Fetches up to N memories for the current user matching a semantic search query.
 * Uses Clerk auth + Supabase profile; useful for curated lens views (e.g. sandbox demo).
 */
export async function getCurrentUserMemoriesBySearch(
  query: string,
  limit: number = 5,
): Promise<Result<SearchResult, string>> {
  const { userId: clerkUserId } = await auth();
  if (!clerkUserId) {
    return { data: null, error: "Not signed in" };
  }

  const { getSupabaseUserId } = await import("@/data/supabase/profiles");
  const sbResult = await getSupabaseUserId(clerkUserId);
  if (sbResult.error || sbResult.data === null) {
    return { data: null, error: "User profile not found" };
  }

  try {
    const result = await searchMemories(query, sbResult.data, { limit });
    return { data: result, error: null };
  } catch (error) {
    return {
      data: null,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

export async function getAllMemories(userId: string): Promise<SearchResult> {
  if (!userId) {
    throw new Error("User ID is required");
  }

  const memory = getMemory();

  const result: SearchResult = await memory.getAll({ userId });

  return result;
}

/**
 * Adds the latest messages to memory
 * Should only contain new messages
 *
 * @param messages - The messages to add to memory
 * @param userId
 * @returns
 */
export async function addLatestMessagesToMemory(
  messages: UIMessage[],
  userId: string,
  chatId?: string,
): Promise<SearchResult> {
  if (!userId) {
    throw new Error("User ID is required");
  }

  const memory = getMemory();

  logger.log(
    "addLatestMessagesToMemory",
    `Adding ${messages.length} messages to memory`,
  );

  const interactions: Message[] = messages.map((m) =>
    convertUIMessageToMem0Message(m, "chat_id_placeholder"),
  );

  const result = await memory.add(interactions, {
    userId,
  });

  logger.log(
    "addLatestMessagesToMemory",
    `Added ${result.results?.length} messages to memory`,
  );
  logger.log(
    "addLatestMessagesToMemory",
    `Results: ${JSON.stringify(result.results)}`,
  );

  return result;
}

/**
 * Adds an interaction to a memory, should just be latest message to AI and it's response
 *
 */
export async function addInteractionToMemory(
  userQuery: string,
  aiResponse: string,
  userId: string,
): Promise<SearchResult> {
  if (!userId) {
    throw new Error("User ID is required");
  }
  logger.log("addInteractionToMemory", `Adding interaction to memory`);

  const memory = getMemory();

  let result: SearchResult;

  try {
    const interaction: Message[] = [
      {
        role: "user",
        content: userQuery,
      },
      {
        role: "assistant",
        content: aiResponse,
      },
    ];

    result = await memory.add(interaction, {
      userId,
    });
    logger.log("addInteractionToMemory", `Added interaction to memory`);
    logger.log(
      "addInteractionToMemory",
      `Results: ${JSON.stringify(result.results)}`,
    );
  } catch (error) {
    logger.error(
      "addInteractionToMemory",
      "Error adding interaction to memory:",
      error,
    );

    return {
      results: [],
      relations: [],
    };
  }

  return result;
}

/**
 * Wipes all memories for a user
 *
 * @param userId - The ID of the user to wipe memory for
 * @returns True if memory wiped, false if errored
 * TODO: Clean up return type to return a more useful result
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
 * Deletes a memory from the database
 *
 * @param memoryId - The ID of the memory to delete
 * @returns - True if memory deleted, false if errored
 * TODO: Clean up return type to return a more useful result
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
