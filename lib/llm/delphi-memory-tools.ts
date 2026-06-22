import type { Message } from "mem0ai/oss";

import { type ToolSet, tool } from "ai";

import {
  commitMemoryInputSchema,
  flagPayloadSchema,
  linkMemoriesInputSchema,
  proposeMemoryInputSchema,
} from "@/lib/llm/delphi-memory-tool-schemas";
import { createLogger } from "@/lib/logger";
import { addMemoryForUser } from "@/lib/memory/operations";

const logger = createLogger("lib/llm/delphi-memory-tools.ts");

export {
  DELPHI_MEMORY_TEXT_MAX,
  commitMemoryInputSchema,
  proposeMemoryInputSchema,
} from "@/lib/llm/delphi-memory-tool-schemas";

export type DelphiMemoryToolsParams = {
  sbUserId: string;
  chatId: string;
};

export type DelphiMemoryToolsOptions = {
  /** Wire deferred stubs (`link_memories`, `flag_*`) into the toolset. Off by default until persistence ships. */
  includeDeferredTools?: boolean;
};

/**
 * Deferred Delphi tools — not registered in production until persistence lands.
 * Re-enable via `createDelphiMemoryTools({ includeDeferredTools: true })`.
 */
export function createDelphiDeferredMemoryTools(): ToolSet {
  const link_memories = tool({
    description:
      "Connect two existing memories after the user agrees. v1 is Mem0-local only (not the future product knowledge graph). Persistence deferred: Mem0 OSS update() is text-only; Phase 2 adds Supabase or metadata linking.",
    inputSchema: linkMemoriesInputSchema,
    execute: async () => ({
      ok: false as const,
      deferred: true as const,
      message:
        "link_memories persistence is not available yet. Capture the relationship in commit_memory text, or retry after linking is implemented.",
    }),
  });

  const flag_for_followup = tool({
    description:
      "Silent curriculum note when a topic closes but is worth revisiting later. (Persistence deferred.)",
    inputSchema: flagPayloadSchema,
    execute: async () => ({
      ok: false as const,
      deferred: true as const,
      message: "flag_for_followup storage is not implemented yet.",
    }),
  });

  const flag_for_review = tool({
    description: "Mark an item for the reconciliation pass. (Persistence deferred.)",
    inputSchema: flagPayloadSchema,
    execute: async () => ({
      ok: false as const,
      deferred: true as const,
      message: "flag_for_review storage is not implemented yet.",
    }),
  });

  return {
    link_memories,
    flag_for_followup,
    flag_for_review,
  };
}

/**
 * Delphi-only tools (plus `search_memories` registered separately in compileChatTools).
 */
export function createDelphiMemoryTools(
  params: DelphiMemoryToolsParams,
  options?: DelphiMemoryToolsOptions
): {
  tools: ToolSet;
  toolInstructions: string;
} {
  const { sbUserId, chatId } = params;

  const propose_memory = tool({
    description:
      "Validate and echo a candidate memory for hard-commit confirmation. Does not write to Mem0.",
    inputSchema: proposeMemoryInputSchema,
    execute: async ({ text, rationale }) => {
      const normalized = text.trim();

      logger.log("propose_memory", "draft", {
        charCount: normalized.length,
        hasRationale: Boolean(rationale),
      });

      return {
        status: "draft" as const,
        text: normalized,
        charCount: normalized.length,
      };
    },
  });

  const commit_memory = tool({
    description:
      "Store one intentional memory in the user's Mem0 corpus. Use after soft commit or after the user confirms a proposal. Does not replace search_memories.",
    inputSchema: commitMemoryInputSchema,
    execute: async ({ text, topic }) => {
      const body = text.trim();
      const metadata: Record<string, unknown> = {
        source: "delphi",
        chat_id: chatId,
      };

      if (topic?.trim()) {
        metadata.topic = topic.trim();
      }

      const messages: Message[] = [
        { role: "user", content: body },
        { role: "assistant", content: "Recorded." },
      ];

      const result = await addMemoryForUser(sbUserId, {
        messages,
        metadata,
        infer: false,
      });

      if (result.error != null) {
        logger.error("commit_memory", result.error);

        return {
          success: false as const,
          error: result.error,
          memories: [],
        };
      }

      return {
        success: true as const,
        memories: result.data?.results ?? [],
        count: result.data?.results?.length ?? 0,
      };
    },
  });

  const toolInstructions = [
    "Delphi tools:",
    "- propose_memory: echo a draft only; no Mem0 write.",
    "- commit_memory: store one distilled memory (metadata includes source=delphi and this chat id). Prefer infer-off verbatim text.",
    "- To link memories or flag follow-ups, encode the relationship in commit_memory text until dedicated tools ship.",
  ].join("\n");

  const tools: ToolSet = {
    propose_memory,
    commit_memory,
  };

  if (options?.includeDeferredTools) {
    Object.assign(tools, createDelphiDeferredMemoryTools());
  }

  return { tools, toolInstructions };
}

/** Tool description for search_memories when the Delphi experience is active. */
export const DELPHI_SEARCH_MEMORIES_DESCRIPTION =
  "Search the user's memory corpus at session start and when cross-referencing. Use a focused query; results are ranked for recall.";
