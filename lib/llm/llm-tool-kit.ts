import { tool } from "ai";
import { z } from "zod";

import { searchMemories } from "@/lib/memory/operations";
import { SearchMemoryToolSchema } from "@/lib/schemas/llm-tools";
import { createLogger } from "../logger";
import { exaSearchOptionsSchema, searchOptionsSchema } from "../exa/types";
import { searchWeb, searchWebWithQuery } from "../exa/client";
import { mapSearchResponseToExaSources } from "../exa/utils";
import { ContentsOptions } from "exa-js";
import { ChatAIActionEnum } from "@/types/ai";
import type { ExaSearchResultSource } from "../exa/types";

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

/** Minimal writer type for streaming sources to the client; avoids importing ChatUIMessage here. */
export type WebSearchStreamWriter = {
  write: (part: {
    type: "data-aiAction";
    data: {
      action: ChatAIActionEnum.Search;
      sources?: ExaSearchResultSource[];
    };
    transient?: boolean;
  }) => void;
};

export const createWebSearchTool = ({
  maxNumResults,
  writer,
}: {
  maxNumResults?: number;
  writer?: WebSearchStreamWriter;
}) => {
  return tool({
    description:
      "Search the web for information. Don't repeat the same query if the first result answers the question.",
    inputSchema: z.object({
      query: z.string().describe("The query to search for"),
      options: searchOptionsSchema.partial().optional(),
    }),
    execute: async ({ query, options }) => {
      const numResultsToUse = Math.min(
        options?.numResults ?? 3,
        maxNumResults ?? 10,
      );

      const contentsToUse: ContentsOptions = {
        highlights: true,
      };

      const webSearchResult = await searchWebWithQuery(query, {
        ...options,
        numResults: numResultsToUse,
        contents: contentsToUse,
      });

      if (writer && webSearchResult.data?.results?.length) {
        const sources = mapSearchResponseToExaSources(
          webSearchResult.data.results,
        );
        writer.write({
          type: "data-aiAction",
          data: { action: ChatAIActionEnum.Search, sources },
          transient: true,
        });
      }

      return webSearchResult;
    },
  });
};

export const webSearchTool = tool({
  description: "Search the web for information",
  inputSchema: z.object({
    query: z.string().describe("The query to search for"),
    options: exaSearchOptionsSchema.optional(),
  }),
  execute: async ({ query, options }) => {
    return await searchWeb(query, options);
  },
});
/**
 * A pseudo tool allowing the LLM to request addition of a persisted schema.
 * Returns a "not yet implemented" message to the LLM.
 */
export const addSchemaTool = tool({
  description:
    "Request to add a new persisted schema. Use this when you want to suggest a new data type or schema for long-term storage. (Note: Not yet implemented, always returns a not-implemented message.)",
  inputSchema: z.object({
    schemaName: z.string().describe("Proposed name for the new schema"),
    schemaDefinition: z
      .string()
      .describe(
        "Definition of the schema, such as a JSON schema or description.",
      ),
    reason: z
      .string()
      .optional()
      .describe("Reason or motivation for adding this new schema"),
  }),
  execute: async ({ schemaName, schemaDefinition, reason }) => {
    switch (schemaName) {
      // Add cases here, can group schema update logic
      default:
        return {
          success: false,
          message: `The ability to add persisted schemas (${schemaName}) is not yet implemented.`,
          schemaName,
          schemaDefinition,
          reason,
          notImplemented: true,
        };
    }
  },
});

/**
 * A pseudo tool allowing the LLM to request updating a persisted schema.
 * Returns a "not yet implemented" message to the LLM.
 */
export const updateSchemaTool = tool({
  description:
    "Request to update the definition of an existing persisted schema. Use this when you want to modify a data type or schema previously defined for long-term storage. (Note: Not yet implemented, always returns a not-implemented message.)",
  inputSchema: z.object({
    schemaName: z.string().describe("Name of the schema to update"),
    newSchemaDefinition: z
      .string()
      .describe(
        "New definition of the schema, such as a JSON schema or updated description.",
      ),
    reason: z
      .string()
      .optional()
      .describe("Reason or motivation for updating this schema"),
  }),
  execute: async ({ schemaName, newSchemaDefinition, reason }) => {
    // In a real implementation, you would update the schema definition here
    // For now, return a not-implemented message
    return {
      success: false,
      message: `The ability to update persisted schemas (${schemaName}) is not yet implemented.`,
      schemaName,
      newSchemaDefinition,
      reason,
      notImplemented: true,
    };
  },
});
