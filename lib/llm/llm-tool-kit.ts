import { tool } from "ai";
import { z } from "zod";

import { searchMemories } from "@/lib/memory/operations";
import { SearchMemoryToolSchema } from "@/lib/schemas/llm-tools";
import { createLogger } from "../logger";

const logger = createLogger("llm-tool-kit");

export const weatherTool = tool({
  description: "Get the weather in a location",
  inputSchema: z.object({
    location: z.string().describe("The location to get the weather for"),
  }),
  // location below is inferred to be a string:
  execute: async ({ location }) => ({
    location,
    temperature: 31415.926,
  }),
});

/**
 * Creates a memory search tool for a specific user
 * @param userId - The user ID to search memories for
 * @returns A tool instance that can search the user's memories
 */
export function createMemorySearchTool(userId: string) {
  return tool({
    description:
      "Search through the user's stored memories to find relevant information from past conversations. Use this when you need to recall specific details, preferences, or context from previous interactions.",
    inputSchema: SearchMemoryToolSchema,
    execute: async ({ query, limit }) => {
      logger.log("createMemorySearchToool", "LLM has invoked memory search");
      try {
        const result = await searchMemories(query, userId, { limit });
        return {
          success: true,
          query,
          memories: result.results || [],
          count: result.results?.length || 0,
        };
      } catch (error) {
        return {
          success: false,
          query,
          error: error instanceof Error ? error.message : "Unknown error",
          memories: [],
          count: 0,
        };
      }
    },
  });
}
