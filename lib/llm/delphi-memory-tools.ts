import type { Message } from "mem0ai/oss";

import { type ToolSet, tool } from "ai";

import {
  commitMemoryInputSchema,
  flagPayloadSchema,
  linkMemoriesInputSchema,
  proposeMemoryInputSchema,
  emptyOptionalText,
  requireDelphiToolText,
} from "@/lib/llm/delphi-memory-tool-schemas";
import { createLogger } from "@/lib/logger";
import { addMemoryForUser } from "@/lib/memory/operations";
import { recordDelphiFlagFeedback } from "@/lib/memory/feedback";

const logger = createLogger("lib/llm/delphi-memory-tools.ts");

export {
  DELPHI_MEMORY_TEXT_MAX,
  commitMemoryInputSchema,
  proposeMemoryInputSchema,
} from "@/lib/llm/delphi-memory-tool-schemas";

/** Narrowed UI stream writer for Delphi's commit receipt (cast from the shared chat writer). */
export type DelphiMemoryStreamWriter = {
  write: (
    part:
      | {
          type: "data-memoryCommitted";
          data: { id: string | null; text: string; topic?: string };
          transient?: boolean;
        }
      | {
          type: "data-memoryCommitFailed";
          data: { text: string; topic?: string; error: string };
          transient?: boolean;
        }
  ) => void;
};

export type DelphiMemoryToolsParams = {
  sbUserId: string;
  chatId: string;
  writer?: DelphiMemoryStreamWriter;
};

export type DelphiMemoryToolsOptions = {
  /** Wire deferred stubs (`link_memories`, `flag_*`) into the toolset. Off by default until persistence ships. */
  includeDeferredTools?: boolean;
};

/**
 * Deferred Delphi tools (`link_memories`, `flag_for_followup`, `flag_for_review`) are
 * defined inline in `createDelphiMemoryTools` (they need request context: `sbUserId` /
 * `chatId`) and registered when `includeDeferredTools` is set.
 */

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
  const { sbUserId, chatId, writer } = params;

  const propose_memory = tool({
    description:
      "Validate and echo a candidate memory for hard-commit confirmation. Does not write to Mem0.",
    inputSchema: proposeMemoryInputSchema,
    execute: async ({ text, rationale }) => {
      const normalized = requireDelphiToolText(text, "text");
      const rationaleTrimmed = emptyOptionalText(rationale);

      logger.log("propose_memory", "draft", {
        charCount: normalized.length,
        hasRationale: Boolean(rationaleTrimmed),
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
      "Store one intentional memory in the user's Mem0 corpus. Use after soft commit or after the user confirms a proposal. Does not replace search_memories. On failure (success: false) nothing is stored — there is no session queue or automatic retry; tell the user honestly and offer a single manual retry.",
    inputSchema: commitMemoryInputSchema,
    execute: async ({ text, topic }) => {
      const body = requireDelphiToolText(text, "text");
      const topicTrimmed = emptyOptionalText(topic);
      const metadata: Record<string, unknown> = {
        source: "delphi",
        chat_id: chatId,
      };

      if (topicTrimmed) {
        metadata.topic = topicTrimmed;
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

        writer?.write({
          type: "data-memoryCommitFailed",
          data: {
            text: body,
            error: result.error,
            ...(topicTrimmed ? { topic: topicTrimmed } : {}),
          },
          transient: true,
        });

        return {
          success: false as const,
          error: result.error,
          memories: [],
          persisted: false as const,
          guidance:
            "Nothing was stored. Do not promise to file later or hold this for the session. Tell the user the write failed and offer one retry via commit_memory if they want.",
        };
      }

      const stored = result.data?.results ?? [];

      // Surface what was actually filed so the chamber can show a "Filed … / Undo" receipt.
      if (stored.length > 0) {
        writer?.write({
          type: "data-memoryCommitted",
          data: {
            id: stored[0]?.id ?? null,
            text: body,
            ...(topicTrimmed ? { topic: topicTrimmed } : {}),
          },
          transient: true,
        });
      }

      return {
        success: true as const,
        memories: stored,
        count: stored.length,
      };
    },
  });

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
      "Silent curriculum note when a topic closes but is worth revisiting later.",
    inputSchema: flagPayloadSchema,
    execute: async ({ note, context, memory_id }) => {
      const flagNote = requireDelphiToolText(note, "note");
      const contextTrimmed = emptyOptionalText(context);
      const combined = contextTrimmed ? `${flagNote}\n\n${contextTrimmed}` : flagNote;
      const result = await recordDelphiFlagFeedback({
        userId: sbUserId,
        chatId,
        signal: "flag_followup",
        note: combined,
        memoryId: emptyOptionalText(memory_id),
      });

      if (result.error) {
        return { ok: false as const, error: result.error };
      }

      return { ok: true as const, stored: true as const };
    },
  });

  const flag_for_review = tool({
    description: "Mark an item for the reconciliation pass.",
    inputSchema: flagPayloadSchema,
    execute: async ({ note, context, memory_id }) => {
      const flagNote = requireDelphiToolText(note, "note");
      const contextTrimmed = emptyOptionalText(context);
      const combined = contextTrimmed ? `${flagNote}\n\n${contextTrimmed}` : flagNote;
      const result = await recordDelphiFlagFeedback({
        userId: sbUserId,
        chatId,
        signal: "flag_review",
        note: combined,
        memoryId: emptyOptionalText(memory_id),
      });

      if (result.error) {
        return { ok: false as const, error: result.error };
      }

      return { ok: true as const, stored: true as const };
    },
  });

  const toolInstructions = [
    "Delphi tools:",
    "- propose_memory: echo a draft only; no Mem0 write.",
    "- commit_memory: store one distilled memory (metadata includes source=delphi and this chat id). Prefer infer-off verbatim text. If success is false, nothing was saved — no queue exists; say so plainly and offer at most one retry.",
    "- link_memories: currently returns deferred=true until persistence lands.",
    "- flag_for_followup / flag_for_review: persist operator flags to memory_feedback.",
  ].join("\n");

  const tools: ToolSet = {
    propose_memory,
    commit_memory,
  };

  if (options?.includeDeferredTools) {
    Object.assign(tools, { link_memories, flag_for_followup, flag_for_review });
  }

  return { tools, toolInstructions };
}

/** Tool description for search_memories when the Delphi experience is active. */
export const DELPHI_SEARCH_MEMORIES_DESCRIPTION =
  "Search the user's memory corpus at session start and when cross-referencing. Use a focused query; results are ranked for recall.";
