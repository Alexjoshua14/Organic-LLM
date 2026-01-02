// Outline
// Functions to control
//   - Set memory archetype displaay

import { searchMemories, searchMemoriesServer } from "@/lib/memory/operations";
import { MemoryItem } from "@/lib/schemas/memory";
import { Tool, tool } from "ai";
import { z } from "zod";

export const showMemoriesTool = tool({
  description:
    "Show the user's memories, use memory search tool to get memories",
  inputSchema: z.object({
    memories: z
      .array(MemoryItem)
      .describe("The memories to display to the user"),
  }),
  execute: async ({ memories }) => {
    // Set archetype on Client Side
    // Implementation relies on client side parsing

    // Output memories
    return {
      memories,
      count: memories.length,
    };
  },
});

export const searchAndShowMemoriesTool = tool({
  description:
    "Search for memories and show the user's memories based on a query",
  inputSchema: z.object({
    query: z.string().describe("The query to search for memories"),
  }),
  outputSchema: z.object({
    memories: z.array(MemoryItem),
    count: z.number(),
    query: z.string(),
  }),
  execute: async ({ query }) => {
    const result = await searchMemoriesServer(query);
    if (result.error) {
      return {
        memories: [],
        count: 0,
        query,
        error: result.error,
      };
    }

    const memories = result.data?.results || [];

    // Set archetype on Client Side
    // Implementation relies on client side parsing

    // Output memories
    return {
      memories,
      count: memories.length,
      query,
    };
  },
});

export const memoryTools: Tool[] = [
  showMemoriesTool,
  searchAndShowMemoriesTool,
];
