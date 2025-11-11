import {
  Message,
  SearchMemoryOptions,
  SearchResult,
  type Memory,
} from "mem0ai/oss";
import memory from "./client";

import { createLogger } from "@/lib/logger";
import { UIMessage } from "@ai-sdk/react";

const logger = createLogger("lib/memory/operations.ts");

/**
 * Searches for memories based on a query.
 * By default grabs top 3 relevant memories.
 *
 * @param query - The query to search for
 * @param userId - The ID of the user to search memories for
 * @param options - Optional search options
 * @returns - The search results
 */
export async function searchMemories(
  query: string,
  userId: string,
  options?: SearchMemoryOptions
): Promise<SearchResult> {
  if (!userId) {
    throw new Error("User ID is required");
  }

  logger.log("searchMemories", `Searching for memories: ${query}`);

  const result = await memory.search(query, {
    userId,
    limit: options?.limit ?? 3,
    ...options,
  });

  logger.log("searchMemories", `Found ${result.results?.length} memories`);

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
  userId: string
): Promise<SearchResult> {
  if (!userId) {
    throw new Error("User ID is required");
  }
  logger.log(
    "addLatestMessagesToMemory",
    `Adding ${messages.length} messages to memory`
  );

  const interactions: Message[] = messages.map((message) => ({
    role: message.role,
    content:
      message.parts
        .filter((part) => part.type === "text")
        .reduce((acc, part) => acc + part.text, "") ?? "",
  }));

  const result = await memory.add(interactions, {
    userId,
  });
  logger.log(
    "addLatestMessagesToMemory",
    `Added ${result.results?.length} messages to memory`
  );
  logger.log(
    "addLatestMessagesToMemory",
    `Results: ${JSON.stringify(result.results)}`
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
  userId: string
): Promise<SearchResult> {
  if (!userId) {
    throw new Error("User ID is required");
  }
  logger.log("addInteractionToMemory", `Adding interaction to memory`);

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
      `Results: ${JSON.stringify(result.results)}`
    );
  } catch (error) {
    logger.error(
      "addInteractionToMemory",
      "Error adding interaction to memory:",
      error
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
async function deleteMemory(memoryId: string): Promise<boolean> {
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
