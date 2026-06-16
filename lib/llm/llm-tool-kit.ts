import type { ExaSearchResultSource } from "../exa/types";

import { GatewayModelId, generateText, tool } from "ai";
import { z } from "zod";
import { UIMessage } from "ai";
import { ContentsOptions } from "exa-js";

import { createLogger } from "../logger";
import { exaSearchOptionsSchema, searchOptionsSchema } from "../exa/types";
import { searchWeb, searchWebWithQuery } from "../exa/client";
import { mapSearchResponseToExaSources } from "../exa/utils";

import { getMessages, getMessagesSince, getNMessages } from "@/data/supabase/chat";
import { estimateTokenCount } from "@/lib/llm/chat-helpers";
import { searchMemoriesWithL1Cache } from "@/lib/memory/memory-search-cache";
import {
  ARCADIA_MEMORY_MIN_SCORE,
  MEMORY_TOOL_OVERFETCH_CAP,
  MEMORY_TOOL_OVERFETCH_MIN,
  bucketMemoriesByTier,
  selectMemoriesForPrompt,
  toMemorySearchInventory,
} from "@/lib/memory/memory-relevance";
import { SearchMemoryToolSchema } from "@/lib/schemas/llm-tools";
import { ChatAIActionEnum } from "@/types/ai";
import {
  MERMAID_DIAGRAM_FIX_SYSTEM_PROMPT,
  MERMAID_DIAGRAM_GENERATOR_SYSTEM_PROMPT,
  MERMAID_DIAGRAM_PLANNER_SYSTEM_PROMPT,
} from "@/lib/system-prompt/mermaid-diagram-prompt";

const logger = createLogger("llm-tool-kit");

/** Max tokens to return from get_more_chat_history so we don't blow up the context window. */
const MAX_TOKENS_FOR_HISTORY = 4000;

/** Max tokens for full history and date-filtered history tools. */
const MAX_TOKENS_FULL_HISTORY = 24000;
/** Token caps for Mermaid tool sub-calls to avoid unbounded tool latency/cost. */
const MERMAID_PLANNER_MAX_OUTPUT_TOKENS = 700;
const MERMAID_GENERATOR_MAX_OUTPUT_TOKENS = 2200;

let mermaidValidationInit: Promise<any> | null = null;

async function getMermaidForValidation(): Promise<any> {
  mermaidValidationInit ??= import("mermaid").then((mod: any) => {
    const m = mod?.default ?? mod;

    // Server-side validation: we only need parse/render syntax checks.
    m.initialize({ startOnLoad: false, theme: "neutral", securityLevel: "loose" });

    return m;
  });

  return mermaidValidationInit;
}

async function validateMermaidCode(code: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const mermaid = await getMermaidForValidation();

    // mermaid.parse throws on invalid syntax.
    await mermaid.parse(code);

    return { ok: true };
  } catch (err) {
    const e: any = err;
    const msg =
      typeof e?.str === "string"
        ? e.str
        : e instanceof Error
          ? e.message
          : typeof e === "string"
            ? e
            : "Mermaid parse failed";

    // Mermaid can throw a runtime sanitize error in server environments.
    // Do not mark this as valid; return a targeted error so the generator can retry/fix.
    if (/sanitize\s+is\s+not\s+a\s+function/i.test(msg)) {
      logger.warn(
        "mermaid_validation",
        "Server Mermaid validation hit sanitize runtime issue; requesting retry/fix."
      );

      return {
        ok: false,
        error:
          "Server-side Mermaid validator hit a sanitize runtime issue. Regenerate with strict Mermaid syntax only (no HTML labels), and keep it compatible with Mermaid run() in browser.",
      };
    }

    return { ok: false, error: msg };
  }
}

function stripMermaidSecurityInitLines(source: string): string {
  return source
    .split("\n")
    .filter((line) => {
      const t = line.trim();

      if (!t.startsWith("%%")) return true;
      if (!/init\s*:/i.test(t)) return true;

      return !/securityLevel/i.test(t);
    })
    .join("\n");
}

function normalizeMermaidCode(raw: string): string {
  return stripMermaidSecurityInitLines(
    raw
      .replace(/^```(?:mermaid)?\s*/i, "")
      .replace(/```$/i, "")
      .trim()
  );
}

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
 * AI SDK tool: **`search_memories`** — vector recall over the user’s Mem0 graph.
 *
 * - **Query:** Uses `query` from the model **verbatim** (no LLM rewrite in the tool path).
 * - **Over-fetch:** Requests a wide Mem0 `limit`, then {@link selectMemoriesForPrompt} slices to
 *   the tool’s requested `limit` so the model still sees high-signal rows.
 * - **Cache:** Delegates to {@link searchMemoriesWithL1Cache} for per-process dedupe.
 *
 * @param userId - Supabase user id (resolved server-side).
 * @param writer - Optional UI stream for transient “memory search” actions.
 * @returns A `tool({ ... })` instance registered under the key `search_memories`.
 */
export function createMemorySearchTool(
  userId: string,
  writer?: WebSearchStreamWriter,
  options?: { description?: string }
) {
  const description =
    options?.description ??
    "Search through the user's stored memories to find relevant information from past conversations. Use this when you need to recall specific details, preferences, or context from previous interactions.";

  return tool({
    description,
    inputSchema: SearchMemoryToolSchema,
    execute: async ({ query, limit }) => {
      logger.log("createMemorySearchTool", "LLM has invoked memory search");
      if (writer) {
        writer.write({
          type: "data-aiAction",
          data: { action: ChatAIActionEnum.Memory, query },
          transient: true,
        });
      }
      try {
        const requestedLimit = limit ?? 3;
        const limitForStore = Math.min(
          MEMORY_TOOL_OVERFETCH_CAP,
          Math.max(requestedLimit, MEMORY_TOOL_OVERFETCH_MIN)
        );

        const searchRun = await searchMemoriesWithL1Cache(userId, query, limitForStore);
        const perQuery = [
          {
            q: query,
            cacheHit: searchRun.metrics.cacheHit,
            searchMs: searchRun.metrics.memorySearchMs,
            error: searchRun.result.error ?? null,
          },
        ];

        const full = searchRun.result.error ? [] : (searchRun.result.data?.results ?? []);

        if (searchRun.result.error) {
          logger.log("createMemorySearchTool", "memory_search_error", {
            rawQuery: query,
            rewrittenQueries: [query],
            queryRewriteUsed: false,
            rewriteMs: 0,
            perQuery,
            error: searchRun.result.error,
          });

          return {
            success: false,
            query,
            rawQuery: query,
            queryRewriteUsed: false,
            rewrittenQueries: [query],
            error: searchRun.result.error,
            memories: [],
            count: 0,
          };
        }

        logger.log("createMemorySearchTool", "memory_search_ok", {
          rawQuery: query,
          rewrittenQueries: [query],
          queryRewriteUsed: false,
          rewriteMs: 0,
          perQuery,
          mergedCount: full.length,
          limitForStore,
        });

        const tiers = bucketMemoriesByTier(full, ARCADIA_MEMORY_MIN_SCORE);
        const sliced = selectMemoriesForPrompt(full, {
          maxIncluded: requestedLimit,
          minScore: ARCADIA_MEMORY_MIN_SCORE,
        });
        const memoryInventory = toMemorySearchInventory(tiers, limitForStore, requestedLimit);

        return {
          success: true,
          query,
          rawQuery: query,
          queryRewriteUsed: false,
          rewrittenQueries: [query],
          memories: sliced,
          count: sliced.length,
          memoryInventory,
        };
      } catch (error) {
        return {
          success: false,
          query,
          rawQuery: query,
          queryRewriteUsed: false,
          rewrittenQueries: [query],
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

const MermaidDiagramToolSchema = z.object({
  prompt: z
    .string()
    .describe(
      "What the diagram should show (entities + relationships + any ordering). Include any constraints like diagram type or nodes to include/exclude."
    ),
  diagramType: z
    .enum(["flowchart", "sequence", "state", "class", "entityRelationship"])
    .optional()
    .describe("Optional hint for what kind of mermaid diagram to generate."),
});

/**
 * Arcadia tool: generate a Mermaid diagram using a small planner model + a stronger generator model.
 * Returns Mermaid source code only (no markdown fences).
 */
export function createMermaidDiagramTool(options?: {
  plannerModelId?: GatewayModelId;
  generatorModelId?: GatewayModelId;
  writer?: WebSearchStreamWriter;
}) {
  const plannerModelId: GatewayModelId = options?.plannerModelId ?? "openai/gpt-5.4-nano";
  const generatorModelId: GatewayModelId = options?.generatorModelId ?? "google/gemini-3-flash";
  const writer = options?.writer;

  return tool({
    description:
      "Generate a Mermaid diagram for the user's request. Use when a visual diagram (flow, sequence, state machine, ERD) would clarify the answer. Returns Mermaid source code only.",
    inputSchema: MermaidDiagramToolSchema,
    execute: async ({ prompt, diagramType }) => {
      if (writer) {
        writer.write({
          type: "data-aiAction",
          data: { action: ChatAIActionEnum.Tool, message: "Planning Mermaid diagram..." },
          transient: true,
        });
      }
      const planningSystem = MERMAID_DIAGRAM_PLANNER_SYSTEM_PROMPT;

      const plan = await generateText({
        model: plannerModelId,
        system: planningSystem,
        prompt: JSON.stringify({ prompt, diagramType }),
        maxOutputTokens: MERMAID_PLANNER_MAX_OUTPUT_TOKENS,
      });

      const generatorSystem = MERMAID_DIAGRAM_GENERATOR_SYSTEM_PROMPT;
      const fixSystem = MERMAID_DIAGRAM_FIX_SYSTEM_PROMPT;

      const MAX_VALIDATION_RETRIES = 2; // attempt 0 + 2 fixes

      let lastValidationError: string | undefined;
      let normalizedCode = "";

      for (let attempt = 0; attempt <= MAX_VALIDATION_RETRIES; attempt++) {
        if (writer) {
          writer.write({
            type: "data-aiAction",
            data: {
              action: ChatAIActionEnum.Tool,
              message:
                attempt === 0
                  ? "Generating Mermaid code..."
                  : `Fixing Mermaid code (attempt ${attempt}...)`,
            },
            transient: true,
          });
        }

        const genOrFixPrompt =
          attempt === 0
            ? "Create the Mermaid diagram from this request and plan.\n\n" +
              `REQUEST:\n${prompt}\n\n` +
              `PLAN_JSON:\n${plan.text}\n` +
              (diagramType ? `\nDIAGRAM_TYPE_HINT:\n${diagramType}\n` : "")
            : "INVALID_MERMAID_CODE:\n" +
              normalizedCode +
              "\n\n" +
              `MERMAID_ERROR_MESSAGE:\n${lastValidationError ?? "Unknown mermaid parse error"}\n` +
              (diagramType ? `\nDIAGRAM_TYPE_HINT:\n${diagramType}\n` : "") +
              "\n\n" +
              `REQUEST:\n${prompt}\n\n` +
              `PLAN_JSON:\n${plan.text}\n`;

        const system = attempt === 0 ? generatorSystem : fixSystem;

        const gen = await generateText({
          model: generatorModelId,
          system,
          prompt: genOrFixPrompt,
          maxOutputTokens: MERMAID_GENERATOR_MAX_OUTPUT_TOKENS,
        });

        normalizedCode = normalizeMermaidCode(gen.text);

        if (writer) {
          writer.write({
            type: "data-aiAction",
            data: { action: ChatAIActionEnum.Tool, message: "Validating Mermaid syntax..." },
            transient: true,
          });
        }

        const v = await validateMermaidCode(normalizedCode);

        if (v.ok) {
          return {
            success: true,
            diagramType: diagramType ?? null,
            code: normalizedCode,
            plannerModelId,
            generatorModelId,
          };
        }

        lastValidationError = v.error;
        logger.warn("mermaid_validation", `Invalid mermaid (attempt ${attempt}): ${v.error}`);
      }

      // If we still can't validate after retries, return the last generated code.
      if (writer) {
        writer.write({
          type: "data-aiAction",
          data: {
            action: ChatAIActionEnum.Tool,
            message: "Returning Mermaid code (validation may fail)...",
          },
          transient: true,
        });
      }

      return {
        success: true,
        diagramType: diagramType ?? null,
        code: normalizedCode,
        plannerModelId,
        generatorModelId,
        validationError: lastValidationError ?? null,
      };
    },
  });
}
