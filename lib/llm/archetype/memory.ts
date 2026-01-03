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

export const memoryTools: Tool[] = [showMemoriesTool];
