"use server";

/**
 * Server-side chat persistence and **context assembly** for LLM routes.
 *
 * **High-signal entry points**
 * - {@link getContext} — system prompt + summary + memories + optional Strata persisted state;
 *   returns recent `UIMessage[]` **without** the current turn (callers append the request message).
 * - {@link saveChat} / {@link loadChat} — thread storage.
 *
 * **Memory:** Non-Arcadia uses a single Mem0 search; Arcadia uses rewrite → parallel search →
 * tiered injection (see `lib/memory/*` and internal `docs/architecture/context-building.md`).
 */
import type { MemoryItemType } from "@/lib/schemas/memory";

import { UIMessage } from "ai";
import { auth } from "@clerk/nextjs/server";

import { createLogger } from "../logger";
import { SYSTEM_PROMPT, PROMETHEUS_SYSTEM_PROMPT } from "../system-prompt/prompt-v0";
import SPARK_SYSTEM_PROMPT from "../system-prompt";
import { getStateString } from "../supabase/organicStateStore";
import { searchMemoriesForUser } from "../memory/operations";
import { searchMemoriesWithL1Cache } from "../memory/memory-search-cache";
import {
  ARCADIA_MEMORY_MAX_INJECTED,
  ARCADIA_MEMORY_MIN_SCORE,
  ARCADIA_MEMORY_OVERFETCH,
  bucketMemoriesByTier,
  buildArcadiaMemoryInventoryText,
  formatMemoriesForPrompt,
  selectMemoriesForPrompt,
} from "../memory/memory-relevance";
import {
  buildRecentTurnsForMemoryRewrite,
  mergeMemorySearchResultsByMaxScore,
  rewriteMemoryQuery,
} from "../memory/query-rewriter";
import {
  CodeBlockSchema,
  ContextPiece,
  KeyValueSchema,
  ListSchema,
  RecipeCardSchema,
  TickerSchema,
} from "../schemas/llm-context";
import { estimateTokenCount } from "../llm/chat-helpers";
import { getPersistedSchemas } from "../persistedSchemas";

import {
  createChat as createChatSupabase,
  loadChat as loadChatSupabase,
  getChats as getChatsSupabase,
  getMessageCount,
  getNMessages,
  getConversationSummary,
  upsertMessages,
  deleteMessage,
  addMessage,
  updateChatStream,
} from "@/data/supabase/chat";
import { upsertMessagesWithAdmin, updateChatStreamWithAdmin } from "@/data/supabase/chat-admin";
import { Result, SimpleResult } from "@/types";
import {
  type ChatExperience,
  isArcadiaStyleMemoryReadExperience,
  isIntrospectionExperience,
} from "@/lib/chat/chat-experience";
import { getIntrospectionBaseSystemPrompt } from "@/lib/personas/introspection";
import { Thread } from "@/lib/schemas/chat";
import { getSupabaseUserId } from "@/data/supabase/profiles";
import { getSupabaseUserIdWithAdmin } from "@/data/supabase/profiles-admin";
import { retryWithBackoff, DEFAULT_RETRY_CONFIG, type RetryConfig } from "@/lib/utils";
import {
  PersistedSchema,
  PersistedSchemaType,
} from "@/app/sandbox/aion/_components/persisted-schemas-container";

const logger = createLogger(`util/chat-store.ts`);

/** Inputs for {@link getContext}. */
interface getContextProps {
  /** Thread id in Supabase. */
  chatId: string;
  /** `getNMessages` window size; Strata callers often use 30, default chat 10. */
  limit?: number;
  /** Selects base system string (Prometheus / Spark / default). */
  persona?: "prometheus" | "spark";
  /**
   * Current user turn. Text is used for Mem0 query / rewrite; the object itself is **not**
   * mutated — routes merge this message onto returned history for `streamText`.
   */
  message: UIMessage;
  /** When false, skips all memory fetches and memory tool hints in context. */
  memoryEnabled?: boolean;
  /** Strata experiences: load persisted UI schema blobs into context. */
  persistedSchemasEnabled?: boolean;
  /**
   * Product mode string from the client. **`arcadia` + memory:** rewrite + parallel Mem0 +
   * tiered prompt + inventory block. Other modes use a single Mem0 search when memory is on.
   */
  experience?: ChatExperience;
}

export async function createChat(): Promise<Result<string>> {
  const res = await createChatSupabase();

  if (res.error) {
    logger.error("createChat", `Error creating chat: ${res.error.message}`);
  } else if (res.data === null) {
    logger.error("createChat", "Error creating chat: Chat ID is null");

    return {
      data: null,
      error: new Error("Chat ID is null"),
    };
  }
  logger.log("createChat", `Chat created: ${res.data}`);

  return res;
}

export async function loadChat(
  id: string
): Promise<Result<{ thread: Thread; messages: UIMessage[] }>> {
  const res = await loadChatSupabase(id);

  if (res.error) {
    logger.error("loadChat", `Error loading chat: ${res.error.message}`);

    return {
      data: null,
      error: new Error(res.error.message),
    };
  }
  logger.log(
    "loadChat",
    `Chat loaded: ${res.data?.thread.id}, ${res.data?.messages.length} messages`
  );

  return res;
}

/**
 *
 * Reads the chat from the database and returns the thread and messages
 * TODO: Either add additional functionality for stream resumption or condense into loadChat function
 *
 * @param id - Chat Id
 * @returns
 */
export async function readChat(
  id: string
): Promise<Result<{ thread: Thread; messages: UIMessage[] }>> {
  const res = await loadChat(id);

  return res;
}

/**
 * Saves the chat idempotently with retry logic and exponential backoff
 *
 * @param chatId - The ID of the chat to save
 * @param messages - The messages to save
 * @returns
 */
export async function saveChat({
  chatId,
  messages,
  activeStreamId,
  useAdminForSave,
  ownerId,
}: {
  chatId: string;
  messages?: UIMessage[];
  activeStreamId?: string | null;
  /** Use admin client for save (avoids expired user JWT in long-running onFinish). Requires ownerId. */
  useAdminForSave?: boolean;
  /** Required when useAdminForSave is true (e.g. sbUserId from start of request). */
  ownerId?: string;
}): Promise<SimpleResult> {
  const retryConfig: RetryConfig = {
    maxRetries: DEFAULT_RETRY_CONFIG.maxRetries,
    initialDelayMs: DEFAULT_RETRY_CONFIG.initialDelayMs,
    maxDelayMs: DEFAULT_RETRY_CONFIG.maxDelayMs,
    backoffMultiplier: DEFAULT_RETRY_CONFIG.backoffMultiplier,
    onRetry: (attempt, error, delayMs) => {
      logger.log(
        "saveChat",
        `Attempt ${attempt} failed, retrying in ${delayMs}ms: ${error instanceof Error ? error.message : String(error)}`
      );
    },
  };

  const useAdmin = Boolean(useAdminForSave && ownerId);

  if (useAdmin) {
    const clerkUser = await auth();

    if (!clerkUser?.userId) {
      logger.error("saveChat", "useAdminForSave requires an authenticated user");

      return { ok: false, error: new Error("Unauthorized") };
    }
    const currentSbUserIdResult = await getSupabaseUserIdWithAdmin(clerkUser.userId);

    if (
      currentSbUserIdResult.error ||
      currentSbUserIdResult.data === null ||
      currentSbUserIdResult.data !== ownerId
    ) {
      logger.error("saveChat", "useAdminForSave ownerId does not match authenticated user");

      return { ok: false, error: new Error("Unauthorized") };
    }
  }

  try {
    let res: SimpleResult = { ok: true, error: new Error("Unknown error") };

    if (messages && messages.length > 0) {
      res = await retryWithBackoff(async () => {
        const result = useAdmin
          ? await upsertMessagesWithAdmin({ chatId, messages, ownerId: ownerId! })
          : await upsertMessages({ chatId, messages });

        // Throw error if the operation failed to trigger retry
        if (result.error || !result.ok) {
          throw new Error(result.error?.message ?? "Unknown error saving chat");
        }

        return result;
      }, retryConfig);
      logger.log("saveChat", `Chat saved: ${chatId}`);
    }

    return res;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";

    logger.error(
      "saveChat",
      `Error saving chat after ${(retryConfig.maxRetries ?? DEFAULT_RETRY_CONFIG.maxRetries) + 1} attempts: ${errorMessage}`
    );

    return {
      ok: false,
      error: error instanceof Error ? error : new Error(errorMessage),
    };
  } finally {
    if (activeStreamId !== undefined) {
      const result = await retryWithBackoff(async () => {
        return useAdmin
          ? await updateChatStreamWithAdmin({ chatId, activeStreamId })
          : await updateChatStream({ chatId, activeStreamId });
      }, retryConfig);

      if (!result.ok) {
        logger.error("saveChat", `Error updating chat stream: ${result.error?.message}`);
      }
    }
  }
}

/**
 * Adds a single message to a chat thread.
 * @param chatId - The thread/chat ID
 * @param message - The UIMessage to add
 * @returns SimpleResult indicating success or failure
 */
export async function saveMessage({
  chatId,
  message,
}: {
  chatId: string;
  message: UIMessage;
}): Promise<SimpleResult> {
  try {
    // This will upsert/create the thread if it doesn't exist, then insert the message
    const result = await addMessage(chatId, message);

    if (!result.ok) {
      logger.error(
        "saveMessage",
        `Failed to save message to thread ${chatId}: ${result.error?.message}`
      );

      return {
        ok: false,
        error: result.error ?? new Error("Unknown error saving message"),
      };
    }
    logger.log("saveMessage", `Message saved to thread: ${chatId}`);

    return { ok: true, error: null };
  } catch (error) {
    logger.error(
      "saveMessage",
      `Error saving message: ${error instanceof Error ? error.message : String(error)}`
    );

    return {
      ok: false,
      error: error instanceof Error ? error : new Error("Unknown error saving message"),
    };
  }
}

/**
 * Deletes a specific message by its ID.
 *
 * @param messageId - The ID of the message to delete.
 * @returns A SimpleResult indicating the outcome of the deletion.
 */
export async function deleteChatMessage(messageId: string): Promise<SimpleResult> {
  try {
    const result = await deleteMessage(messageId);

    if (!result.ok) {
      logger.error(
        "deleteChatMessage",
        `Failed to delete message ${messageId}: ${result.error?.message}`
      );

      return {
        ok: false,
        error: result.error ?? new Error("Unknown error deleting message"),
      };
    }

    logger.log("deleteChatMessage", `Message deleted: ${messageId}`);

    return { ok: true, error: null };
  } catch (error) {
    logger.error(
      "deleteChatMessage",
      `Error deleting message: ${error instanceof Error ? error.message : String(error)}`
    );

    return {
      ok: false,
      error: error instanceof Error ? error : new Error("Unknown error deleting message"),
    };
  }
}

/**
 *
 * @returns List of chats
 */
export async function getChats(): Promise<Result<Thread[]>> {
  const res = await getChatsSupabase();

  if (res.error) {
    logger.error("getChats", `Error getting chats: ${res.error.message}`);

    return {
      data: null,
      error: new Error(res.error.message),
    };
  }

  return res;
}

export async function getChat(
  chatId: string
): Promise<Result<{ thread: Thread; messages: UIMessage[] }>> {
  const chat = await loadChat(chatId);

  if (chat.error) {
    logger.error("getChat", `Error getting chat: ${chat.error.message}`);

    return {
      data: null,
      error: new Error(chat.error.message),
    };
  } else {
    logger.log("getChat", `Chat loaded: ${chat.data?.thread.id}`);
  }

  return chat;
}

/**
 *
 * OLD FUNCITON, NEW ONE BELOW
 *
 * @returns
 */
export async function getMessagesForChatPrompt({
  chatId,
  limit,
  persona,
}: getContextProps): Promise<Result<{ prompt: string; messages: UIMessage[] }, string>> {
  const { data: messages, error } = await getNMessages(chatId, limit);

  if (error || messages === null) {
    logger.error("getMessagesForChatPrompt", `Error getting messages: ${error}`);

    return {
      data: null,
      error: error,
    };
  }

  const conversationSummaryResult = await getConversationSummary(chatId);

  let conversationSummary = "";

  if (conversationSummaryResult.error) {
    logger.error(
      "getMessagesForChatPrompt",
      `Error getting conversation summary: ${conversationSummaryResult.error.message}`
    );
    conversationSummary = "";
  } else if (conversationSummaryResult.data === null) {
    logger.error(
      "getMessagesForChatPrompt",
      `Error getting conversation summary: Conversation summary is null`
    );
    conversationSummary = "";
  } else {
    conversationSummary = conversationSummaryResult.data;
  }

  const prompt =
    persona === "prometheus"
      ? PROMETHEUS_SYSTEM_PROMPT
      : persona === "spark"
        ? SPARK_SYSTEM_PROMPT
        : SYSTEM_PROMPT;

  const systemPrompt = prompt
    .replace("{{currentDateTime}}", new Date().toISOString())
    .concat(`\n\nConversation Summary:\n${conversationSummary}`);

  return {
    data: {
      prompt: systemPrompt,
      messages,
    },
    error: null,
  };
}

/**
 * **Legacy / alternate** context path for Prometheus + Spark HTTP routes (`lib/llm/context`, Spark route).
 * Loads messages + summary (+ Spark organic state). **No Mem0** — use {@link getContext} for memory-aware chat.
 *
 * @remarks Differs from `getContext`: no `message` param, no Arcadia tiering, less parallel I/O.
 */
export async function getContextAndMessagesChatPrompt({
  chatId,
  limit,
  persona,
}: getContextProps): Promise<Result<{ prompt: string; messages: UIMessage[] }, string>> {
  // TODO: Decide fail-fast vs empty messages; parallelize summary fetch with getNMessages.
  const { data: messages, error } = await getNMessages(chatId, limit);

  if (error || messages === null) {
    logger.error("getContextAndMessagesChatPrompt", `Error getting messages: ${error}`);

    return {
      data: null,
      error: error,
    };
  }

  /**
   * Get the system prompt for the persona
   */
  let prompt = "";

  switch (persona) {
    case "prometheus":
      prompt = PROMETHEUS_SYSTEM_PROMPT;
      break;
    case "spark":
      prompt = SPARK_SYSTEM_PROMPT;
      break;
    default:
      prompt = SYSTEM_PROMPT;
      break;
  }

  /**
   * If the persona is Spark, get the context from the organic state store
   */
  if (persona === "spark") {
    logger.log("getContextAndMessagesChatPrompt", "Getting context for Spark");
    try {
      const ctxResult = await getStateString(chatId);

      prompt += `\n\n${ctxResult}`;
    } catch (error) {
      logger.error(
        "getContextAndMessagesChatPrompt",
        `Error getting Spark specific context: ${error}`
      );
    }
  }

  /**
   * Get the conversation summary for the chat
   */
  const conversationSummaryResult = await getConversationSummaryForChatPrompt(chatId);
  const conversationSummary = conversationSummaryResult.data ?? "";

  prompt += `\n\nConversation Summary:\n${conversationSummary}`;

  /**
   * Replace the current date time in the prompt
   */
  const systemPrompt = prompt.replace("{{currentDateTime}}", new Date().toISOString());

  return {
    data: {
      prompt: systemPrompt,
      messages,
    },
    error: null,
  };
}

/** Shared summary loader for {@link getContextAndMessagesChatPrompt} (keeps error logging consistent). */
async function getConversationSummaryForChatPrompt(chatId: string): Promise<Result<string>> {
  let conversationSummary = "";

  const conversationSummaryResult = await getConversationSummary(chatId);

  if (conversationSummaryResult.error) {
    logger.error(
      "getContextAndMessagesChatPrompt",
      `Error getting conversation summary: ${conversationSummaryResult.error.message}`
    );
    conversationSummary = "";
  } else if (conversationSummaryResult.data === null) {
    logger.error(
      "getContextAndMessagesChatPrompt",
      `Error getting conversation summary: Conversation summary is null`
    );
    conversationSummary = "";
  } else {
    conversationSummary = conversationSummaryResult.data;
  }

  return conversationSummaryResult;
}

/**
 * Assembles the **system-side context string** and **recent history** for one chat turn.
 *
 * ### Pipeline (happy path)
 * 1. **Identity** — Clerk + Supabase profile → Mem0 user id.
 * 2. **Kick off I/O** — `getNMessages`, `getConversationSummary`, optional non-Arcadia Mem0 search,
 *    optional persisted schemas (all `Promise.all` in phase 1).
 * 3. **Persona** — Push static system prompt first (better provider cache behavior).
 * 4. **Arcadia memory branch** (if `memoryEnabled && experience === "arcadia"`): after messages resolve,
 *    {@link rewriteMemoryQuery} → parallel {@link searchMemoriesWithL1Cache} per query →
 *    {@link mergeMemorySearchResultsByMaxScore} → {@link selectMemoriesForPrompt} + inventory text.
 * 5. **Assemble** — Summary, memories, tool hint, persisted blocks, "current chat" blurb
 *    (includes {@link getMessageCount}).
 * 6. **Logging** — `finally` block logs wall time + per-section token estimates.
 *
 * ### Return value
 * - `data.context` — single string passed as system instructions (plus route-specific suffixes).
 * - `data.messages` — DB-backed recent turns **excluding** `message`; callers append the live user message.
 *
 * @see `docs/architecture/context-building.md` for dependency and latency notes.
 */
export async function getContext({
  chatId,
  limit,
  persona,
  message,
  memoryEnabled,
  persistedSchemasEnabled = false,
  experience,
}: getContextProps): Promise<
  Result<{ context: string; messages: UIMessage[]; memories?: string[] }, string>
> {
  const startContextCompilationTime = performance.now();

  /***
   * Step 0
   *
   * Get User ID from supabase
   */

  const clerkUser = await auth();

  if (!clerkUser || !clerkUser.userId) {
    logger.error("getContext", "User not authenticated");

    return {
      data: null,
      error: "User not authenticated",
    };
  }
  const sbUserIdResult = await getSupabaseUserId(clerkUser.userId);

  if (sbUserIdResult.error || sbUserIdResult.data === null) {
    logger.error("getContext", "User not found in supabase");

    return {
      data: null,
      error: "User not found in supabase",
    };
  }

  const sbUserId = sbUserIdResult.data;

  const contextPieces: ContextPiece[] = [];
  const contextTokenSizes: Array<{ name: string; tokens: number }> = [];

  try {
    /***
     * Step 1
     *
     * Get Latest n Messages from Supabase
     ***/
    const messagesPromise = getNMessages(chatId, limit);

    /***
     * Step 2
     *
     * Get Conversation Summary from Supabase
     */

    const conversationSummaryPromise = getConversationSummary(chatId);

    /***
     * Step 3
     *
     * Get Memories from Mem0
     ***/
    // Plaintext-only extraction for Mem0 (multimodal parts ignored for search).
    const userMessage = message.parts
      .filter((part) => part.type === "text")
      .reduce((acc, part) => acc + part.text, "");

    logger.log("getContext", `User message length: ${userMessage.length}`);

    // Arcadia defers memory to phase 2 (needs DB messages for rewrite transcript).
    const memNonArcadiaPromise =
      memoryEnabled && !isArcadiaStyleMemoryReadExperience(experience)
        ? searchMemoriesForUser(sbUserId, userMessage, { limit: 5 }).then((r) =>
            r.error ? { results: [] } : r.data!
          )
        : Promise.resolve({ results: [] });

    const persistedExec = persistedSchemasEnabled
      ? getPersistedSchemas(chatId)
      : Promise.resolve({ data: [], error: null });

    /***
     * Step 4
     *
     * Get Persona from wherever
     *
     ***/
    let systemPrompt = "";

    if (isIntrospectionExperience(experience)) {
      systemPrompt = getIntrospectionBaseSystemPrompt();
    } else {
      switch (persona) {
        case "prometheus":
          systemPrompt = PROMETHEUS_SYSTEM_PROMPT;
          break;
        case "spark":
          systemPrompt = SPARK_SYSTEM_PROMPT;
          break;
        default:
          systemPrompt = SYSTEM_PROMPT;
          break;
      }
    }

    systemPrompt = systemPrompt.replace("{{currentDateTime}}", new Date().toISOString());

    contextPieces.push({
      content: systemPrompt,
    });

    // Calculate token count for system prompt
    const systemPromptTokens = await estimateTokenCount(systemPrompt);

    if (systemPromptTokens !== null) {
      contextTokenSizes.push({
        name: "System Prompt",
        tokens: systemPromptTokens,
      });
    }

    /***
     * Step 5
     *
     * Await and combine context from all places
     ***/

    /**
     * Structure:
     *  - System prompt
     *  - Conversation summary
     *  - Memories
     */

    // Slowest of the four dominates latency (usually Supabase and/or Mem0).
    const [messagesResult, conversationSummaryResult, memNonArcadiaResult, persistedSchemaResult] =
      await Promise.all([
        messagesPromise,
        conversationSummaryPromise,
        memNonArcadiaPromise,
        persistedExec,
      ]);

    let memoriesResult: { results: MemoryItemType[] } = { results: [] };
    let arcadiaQueryRewriteUsed: boolean | undefined;
    let arcadiaEffectiveQueryCount: number | undefined;

    if (memoryEnabled && isArcadiaStyleMemoryReadExperience(experience)) {
      // Query rewrite is only for Mem0 search below. Returned `messages` are DB history only;
      // routes append the original request `message` unchanged for the main LLM.
      const historyMessages = messagesResult.data ?? [];
      const recentTurns = buildRecentTurnsForMemoryRewrite(historyMessages, message);
      const rewriteT0 = performance.now();
      const rewrite = await rewriteMemoryQuery(userMessage, recentTurns);
      const rewriteMs = performance.now() - rewriteT0;

      arcadiaQueryRewriteUsed = rewrite.usedRewrite;
      arcadiaEffectiveQueryCount = rewrite.queries.length;

      // One parallel Mem0 call per rewritten query; L1 cache is per (user, query, limit).
      const searchRuns = await Promise.all(
        rewrite.queries.map((q) => searchMemoriesWithL1Cache(sbUserId, q, ARCADIA_MEMORY_OVERFETCH))
      );

      const perQuery = searchRuns.map((run, i) => ({
        queryIndex: i,
        queryLength: rewrite.queries[i]?.length ?? 0,
        cacheHit: run.metrics.cacheHit,
        searchMs: run.metrics.memorySearchMs,
      }));

      const batches = searchRuns.map((run) =>
        run.result.error ? [] : (run.result.data?.results ?? [])
      );
      const merged = mergeMemorySearchResultsByMaxScore(batches);

      memoriesResult = { results: merged };

      logger.log("getContext", "Arcadia memory pipeline", {
        rawQueryLength: userMessage.length,
        rewrittenQueryCount: rewrite.queries.length,
        usedRewrite: rewrite.usedRewrite,
        rewriteMs,
        perQuery,
        mergedCount: merged.length,
      });
    } else if (memoryEnabled) {
      memoriesResult = memNonArcadiaResult;
    }

    /***
     * Step 5a
     *
     * Handle message errors
     */
    let messages: UIMessage[] = [];

    if (messagesResult.error) {
      logger.error("getContext", `Error getting messages: ${messagesResult.error}`);
    }
    messages = messagesResult.data ?? [];

    /***
     * Step 5b
     *
     * Handle conversation summary errors
     */

    let conversationSummary = "";

    if (conversationSummaryResult.error) {
      logger.error(
        "getContext",
        `Error getting conversation summary: ${conversationSummaryResult.error}`
      );
    }
    conversationSummary = conversationSummaryResult.data ?? "";

    contextPieces.push({
      title: "Conversation Summary",
      content: conversationSummary,
    });

    // Calculate token count for conversation summary
    const conversationSummaryTokens = await estimateTokenCount(conversationSummary);

    if (conversationSummaryTokens !== null) {
      contextTokenSizes.push({
        name: "Conversation Summary",
        tokens: conversationSummaryTokens,
      });
    }

    /***
     * Step 5c
     *
     * Handle memories errors
     */
    if (memoryEnabled) {
      let memories = "";

      if (memoriesResult.results === null || memoriesResult.results === undefined) {
        logger.error(
          "getContext",
          `Error getting memories: Memories are null\n${JSON.stringify(memoriesResult)}`
        );
        contextPieces.push({
          title: "Memories from past conversations:",
          content: memories,
        });
      } else if (isArcadiaStyleMemoryReadExperience(experience)) {
        // Over-fetch sample → tier stats for inventory + score-trimmed bullets for the model.
        const items = memoriesResult.results as MemoryItemType[];
        const tiers = bucketMemoriesByTier(items, ARCADIA_MEMORY_MIN_SCORE);
        const selected = selectMemoriesForPrompt(items, {
          maxIncluded: ARCADIA_MEMORY_MAX_INJECTED,
          minScore: ARCADIA_MEMORY_MIN_SCORE,
        });

        memories = formatMemoriesForPrompt(selected);
        const conversationMessagesInContext = messages.length + 1;

        contextPieces.push({
          title: "Memories from past conversations:",
          content: memories,
        });

        contextPieces.push({
          title: "Memory inventory (Arcadia)",
          content: buildArcadiaMemoryInventoryText({
            conversationMessagesInContext,
            memoriesInjected: selected.length,
            tiers,
            overfetchCap: ARCADIA_MEMORY_OVERFETCH,
            minScore: ARCADIA_MEMORY_MIN_SCORE,
            queryRewriteUsed: arcadiaQueryRewriteUsed ?? false,
            effectiveQueryCount: arcadiaEffectiveQueryCount ?? 1,
          }),
        });
      } else {
        memories = memoriesResult.results
          .map((result: { memory?: string }) => result.memory)
          .filter((memory: string | undefined): memory is string => memory != null)
          .join("\n");

        contextPieces.push({
          title: "Memories from past conversations:",
          content: memories,
        });
      }

      contextPieces.push({
        title: "Memory tool usage:",
        content: `Memory is enabled. Use the 'search_memories' tool to look up relevant information from prior conversations. This can help you recall user preferences, past decisions, names, or any details that might not be present in the 'Memories from past conversations' section.`,
      });
      // Calculate token count for memories
      const memoriesTokens = await estimateTokenCount(memories);

      if (memoriesTokens !== null) {
        contextTokenSizes.push({
          name: "Memories",
          tokens: memoriesTokens,
        });
      }
    }

    /***
     * Step 5d
     *
     * Handle persistedSchemas errors
     */

    if (persistedSchemasEnabled) {
      let persitedSchemas: PersistedSchemaType[] = [];

      logger.log("getContext", "Handling persistedSchemas and preparing persistedSchemasResult");

      logger.log("getContext", `persistedSchemaResult: ${JSON.stringify(persistedSchemaResult)}`);

      const rawPersistedRows = persistedSchemaResult.data ?? [];
      const persistedSchemaForLog = rawPersistedRows.map((item) => {
        const parsed = PersistedSchema.safeParse(item);

        return parsed.success ? parsed.data : item;
      });

      logger.log("getContext", `persistedSchemaObject: ${JSON.stringify(persistedSchemaForLog)}`);

      if (persistedSchemaResult.error) {
        logger.error(
          "getContext",
          `Error getting persisted Schema summary: ${persistedSchemaResult.error}`
        );
      }
      if (persistedSchemaResult.data) {
        // Validate/parse with zod here using all schemas
        for (const item of persistedSchemaResult.data) {
          try {
            logger.log("getContext", `Validating persisted schema item: ${JSON.stringify(item)}`);
            // Try each schema until one succeeds, push to persitedSchemas
            switch (item.type) {
              case "list":
                persitedSchemas.push(ListSchema.parse(item));
              case "keyValue":
                persitedSchemas.push(KeyValueSchema.parse(item));
              case "codeBlock":
                persitedSchemas.push(CodeBlockSchema.parse(item));
              case "recipeCard":
                persitedSchemas.push(RecipeCardSchema.parse(item));
              case "ticker":
                persitedSchemas.push(TickerSchema.parse(item));
            }
          } catch (e) {
            logger.error("getContext", `Invalid persisted schema item: ${JSON.stringify(item)}`);
            // Optionally continue on error or throw, we choose to skip invalid items here
            continue;
          }
        }
      } else {
        logger.log("getContext", "No persisted schema data found");
        persitedSchemas = [];
      }

      contextPieces.push({
        title: "Persisted Schemas",
        content: persitedSchemas.map((schema) => JSON.stringify(schema)).join("\n"),
      });
    }

    /***
     * Step 5e
     *
     * Current chat context (total message count + context window size for get_more_chat_history)
     ***/
    const totalCountResult = await getMessageCount(chatId);
    const totalCount = totalCountResult.data ?? null;
    const messagesInContext = messages.length;
    const currentChatContent =
      totalCount !== null
        ? `This thread has ${totalCount} message${totalCount === 1 ? "" : "s"} in total. You have the most recent ${messagesInContext} in your context. When the user refers to something earlier in the conversation that you don't see, use get_more_chat_history to fetch older messages.`
        : `You have the most recent ${messagesInContext} message${messagesInContext === 1 ? "" : "s"} in your context. Use get_more_chat_history when the user refers to something earlier in the conversation.`;

    contextPieces.push({
      title: "Current chat",
      content: currentChatContent,
    });

    /***
     * Step 5d
     *
     * Combine context
     ***/
    const context = combineContextPieces(contextPieces);

    return {
      data: {
        context,
        messages,
      },
      error: null,
    };
  } catch (error) {
    logger.error("getContext", `Error getting context: ${error}`);

    return {
      data: null,
      error: error instanceof Error ? error.message : String(error),
    };
  } finally {
    const endContextCompilationTime = performance.now();

    // Log token sizes for each context piece
    const totalTokens = contextTokenSizes.reduce((sum, piece) => sum + piece.tokens, 0);

    logger.log(
      "getContext",
      `Context compilation time: ${endContextCompilationTime - startContextCompilationTime} milliseconds\n` +
        `Context token sizes:\n` +
        contextTokenSizes.map((piece) => `  - ${piece.name}: ${piece.tokens} tokens`).join("\n") +
        `\n  - Total context tokens: ${totalTokens} tokens`
    );
  }
}

/** Joins ordered sections into one system string (`title` becomes a markdown-ish heading). */
function combineContextPieces(contextPieces: ContextPiece[]): string {
  return contextPieces
    .map((piece) => `${piece.title ? `${piece.title}:\n` : ""}${piece.content}`)
    .join("\n\n");
}
