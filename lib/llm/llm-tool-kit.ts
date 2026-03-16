import type { ExaSearchResultSource } from "../exa/types";

import { tool } from "ai";
import { z } from "zod";
import { UIMessage } from "ai";
import { ContentsOptions } from "exa-js";

import { createLogger } from "../logger";
import { exaSearchOptionsSchema, searchOptionsSchema } from "../exa/types";
import { searchWeb, searchWebWithQuery } from "../exa/client";
import { mapSearchResponseToExaSources } from "../exa/utils";

import { getMessages, getMessagesSince, getNMessages } from "@/data/supabase/chat";
import { estimateTokenCount } from "@/lib/llm/chat-helpers";
import { searchMemories } from "@/lib/memory/store";
import { SearchMemoryToolSchema } from "@/lib/schemas/llm-tools";
import { ChatAIActionEnum } from "@/types/ai";

const logger = createLogger("llm-tool-kit");

/** Max tokens to return from get_more_chat_history so we don't blow up the context window. */
const MAX_TOKENS_FOR_HISTORY = 4000;

/** Max tokens for full history and date-filtered history tools. */
const MAX_TOKENS_FULL_HISTORY = 24000;

/** Format UIMessage[] into a plain string for the model (role + text content). */
function formatMessagesForContext(messages: UIMessage[]): string {
  return messages
    .map((m) => {
      const text = m.parts
        .filter((p): p is { type: "text"; text: string } => p.type === "text")
        .map((p) => p.text)
        .join("");

      return `[${m.role}]: ${text.trim() || "(no text)"}`;
    })
    .join("\n\n");
}

/** Truncate messages from the start (oldest) until formatted string is within token cap. */
async function formatAndCapMessagesByTokens(
  messages: UIMessage[],
  maxTokens: number
): Promise<{
  formatted: string;
  messagesUsed: UIMessage[];
  tokenCount: number;
}> {
  let slice = messages;
  let formatted = formatMessagesForContext(slice);
  let tokenCount = (await estimateTokenCount(formatted)) ?? 0;

  while (tokenCount > maxTokens && slice.length > 1) {
    slice = slice.slice(1);
    formatted = formatMessagesForContext(slice);
    tokenCount = (await estimateTokenCount(formatted)) ?? 0;
  }
  if (tokenCount > maxTokens && slice.length === 1) {
    return {
      formatted: "(Messages exceed token limit; skipping to protect context window.)",
      messagesUsed: [],
      tokenCount: 0,
    };
  }

  return {
    formatted: formatted || "(No messages.)",
    messagesUsed: slice,
    tokenCount,
  };
}

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
export function createMemorySearchTool(userId: string, writer?: WebSearchStreamWriter) {
  return tool({
    description:
      "Search through the user's stored memories to find relevant information from past conversations. Use this when you need to recall specific details, preferences, or context from previous interactions.",
    inputSchema: SearchMemoryToolSchema,
    execute: async ({ query, limit }) => {
      logger.log("createMemorySearchToool", "LLM has invoked memory search");
      if (writer) {
        writer.write({
          type: "data-aiAction",
          data: { action: ChatAIActionEnum.Memory, query },
          transient: true,
        });
      }
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

const GetMoreMessagesToolSchema = z.object({
  limit: z
    .number()
    .min(1)
    .max(50)
    .describe(
      "Number of older messages to fetch from the conversation (1–50). Use when you need more history to answer accurately."
    ),
});

/**
 * Creates a tool that lets the LLM fetch additional (older) messages from the current chat.
 * Use when the model needs more conversation history than was initially provided.
 *
 * @param chatId - Current chat/thread ID
 * @param alreadySentCount - Number of messages already in context (so we fetch only older ones)
 */
export function createGetMoreMessagesTool(chatId: string, alreadySentCount: number) {
  return tool({
    description:
      "Fetch older messages from this conversation when you need more context to answer the user. Call this when the user refers to something earlier in the chat that you don't have in your current context (e.g. a prior decision, topic, or detail).",
    inputSchema: GetMoreMessagesToolSchema,
    execute: async ({ limit }) => {
      const MAX_LIMIT = 50;

      limit = Math.min(limit, MAX_LIMIT);
      logger.log(
        "createGetMoreMessagesTool",
        `Fetching ${limit} older messages for chat ${chatId} (already have ${alreadySentCount})`
      );
      try {
        const result = await getNMessages(chatId, alreadySentCount + limit);

        if (result.error) {
          return {
            success: false,
            error: result.error,
            messages: "",
            count: 0,
          };
        }
        const all = result.data ?? [];
        const olderOnly = all.slice(0, limit);
        const { formatted, messagesUsed, tokenCount } = await formatAndCapMessagesByTokens(
          olderOnly,
          MAX_TOKENS_FOR_HISTORY
        );

        logger.log(
          "createGetMoreMessagesTool",
          `Returning ${messagesUsed.length} message(s), ~${tokenCount} tokens${messagesUsed.length < olderOnly.length ? " (truncated to stay under cap)" : ""}`
        );

        return {
          success: true,
          count: messagesUsed.length,
          messages: formatted || "(No older messages in this thread.)",
        };
      } catch (error) {
        logger.error(
          "createGetMoreMessagesTool",
          `Error: ${error instanceof Error ? error.message : String(error)}`
        );

        return {
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
          messages: "",
          count: 0,
        };
      }
    },
  });
}

/**
 * Fetches the entire conversation history (capped at 24000 tokens). Use only when the user
 * explicitly asks for the full thread, a full summary, or "everything we discussed."
 */
export function createGetFullChatHistoryTool(chatId: string) {
  return tool({
    description:
      "Fetch the entire conversation history for this thread (up to 24000 tokens). Use only when the user explicitly asks for the full conversation, a complete summary of the thread, or 'everything we discussed'—not for routine context. Prefer get_more_chat_history for targeted lookbacks.",
    inputSchema: z.object({}),
    execute: async () => {
      logger.log("createGetFullChatHistoryTool", `Fetching full history for chat ${chatId}`);
      try {
        const result = await getMessages(chatId);

        if (result.error || !result.data) {
          return {
            success: false,
            error: result.error?.message ?? "Failed to load messages",
            messages: "",
            count: 0,
          };
        }
        const messages = result.data;
        const { formatted, messagesUsed, tokenCount } = await formatAndCapMessagesByTokens(
          messages,
          MAX_TOKENS_FULL_HISTORY
        );

        logger.log(
          "createGetFullChatHistoryTool",
          `Returning ${messagesUsed.length} message(s), ~${tokenCount} tokens`
        );

        return {
          success: true,
          count: messagesUsed.length,
          messages: formatted,
        };
      } catch (error) {
        logger.error(
          "createGetFullChatHistoryTool",
          `Error: ${error instanceof Error ? error.message : String(error)}`
        );

        return {
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
          messages: "",
          count: 0,
        };
      }
    },
  });
}

const GetMessagesFromDateToolSchema = z.object({
  date: z
    .string()
    .describe(
      "Date in YYYY-MM-DD format (e.g. 2025-02-01). Returns all messages on or after this date (UTC)."
    ),
});

/**
 * Fetches all messages from a specific date onward (UTC), capped at 24000 tokens.
 */
export function createGetMessagesFromDateTool(chatId: string) {
  return tool({
    description:
      "Fetch all messages from this conversation on or after a specific date. Use when the user asks about 'what we said on [date]', 'messages from [date]', or to recall a past session. Date must be YYYY-MM-DD.",
    inputSchema: GetMessagesFromDateToolSchema,
    execute: async ({ date }) => {
      logger.log(
        "createGetMessagesFromDateTool",
        `Fetching messages since ${date} for chat ${chatId}`
      );
      try {
        const result = await getMessagesSince(chatId, date);

        if (result.error) {
          return {
            success: false,
            error: result.error,
            messages: "",
            count: 0,
          };
        }
        const messages = result.data ?? [];
        const { formatted, messagesUsed, tokenCount } = await formatAndCapMessagesByTokens(
          messages,
          MAX_TOKENS_FULL_HISTORY
        );

        logger.log(
          "createGetMessagesFromDateTool",
          `Returning ${messagesUsed.length} message(s) since ${date}, ~${tokenCount} tokens`
        );

        return {
          success: true,
          count: messagesUsed.length,
          messages: formatted || `(No messages on or after ${date}.)`,
        };
      } catch (error) {
        logger.error(
          "createGetMessagesFromDateTool",
          `Error: ${error instanceof Error ? error.message : String(error)}`
        );

        return {
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
          messages: "",
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
    data:
      | {
          action: ChatAIActionEnum.Search;
          sources?: ExaSearchResultSource[];
        }
      | {
          action: ChatAIActionEnum.Memory;
          query?: string;
        }
      | {
          action: ChatAIActionEnum.Tool;
          message?: string;
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
      const numResultsToUse = Math.min(options?.numResults ?? 3, maxNumResults ?? 10);

      const contentsToUse: ContentsOptions = {
        highlights: true,
      };

      const webSearchResult = await searchWebWithQuery(query, {
        ...options,
        numResults: numResultsToUse,
        contents: contentsToUse,
      });

      if (writer && webSearchResult.data?.results?.length) {
        const sources = mapSearchResponseToExaSources(webSearchResult.data.results);

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
      .describe("Definition of the schema, such as a JSON schema or description."),
    reason: z.string().optional().describe("Reason or motivation for adding this new schema"),
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
      .describe("New definition of the schema, such as a JSON schema or updated description."),
    reason: z.string().optional().describe("Reason or motivation for updating this schema"),
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
