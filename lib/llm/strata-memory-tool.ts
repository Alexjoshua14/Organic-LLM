import { tool } from "ai";
import { z } from "zod";

import { searchMemoriesForUser } from "@/lib/memory/operations";

const StrataMemorySearchSchema = z.object({
  query: z.string().min(1).max(2000),
  limit: z.number().int().min(1).max(20).default(8),
});

export function createStrataMemorySearchTool(userId: string) {
  return tool({
    description:
      "Search Mem0 memories for relevant user context to improve Strata create/update output.",
    inputSchema: StrataMemorySearchSchema,
    execute: async ({ query, limit }) => {
      const result = await searchMemoriesForUser(userId, query, { limit });

      if (result.error || !result.data) {
        return {
          success: false,
          query,
          count: 0,
          memories: [],
          error: result.error ?? "Memory search failed",
        };
      }

      return {
        success: true,
        query,
        count: result.data.results.length,
        memories: result.data.results,
      };
    },
  });
}
