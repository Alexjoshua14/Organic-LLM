import "server-only";

import type { SpeakModalities } from "@/lib/schemas/speak-modalities";
import type { SpeakToolClientEffect } from "@/lib/speak/types";

import { createHash } from "node:crypto";

import { after } from "next/server";
import { z } from "zod";

import { ensureChatHasTitle, updateChatSummary } from "@/lib/llm/chat-helpers";
import {
  isToolAllowedForSession,
  StageVoiceTurnSchema,
  RefreshComponentSchema,
  RenderGenUiSchema,
  SearchMemoriesSchema,
  ShowWebPreviewSchema,
  SpeakToolNameSchema,
  SummarizeThreadSchema,
  UpdateDisplayTextSchema,
  UpdateThreadTitleSchema,
  UpsertUiStateSchema,
  type SpeakToolName,
} from "@/lib/llm/compile-speak-tools";
import { createLogger } from "@/lib/logger";
import { ARCADIA_MEMORY_MIN_SCORE, selectMemoriesForPrompt } from "@/lib/memory/memory-relevance";
import { searchMemoriesWithL1Cache } from "@/lib/memory/memory-search-cache";
import { assertSpeakBudgetOrClose, getSpeakRealtimeSession } from "@/lib/rate-limit/speak-realtime";

const logger = createLogger("lib/speak/execute-speak-tool.ts");

/** Voice wants a few strong hits, not an inventory: fetch wide, keep the top three. */
const SPEAK_MEMORY_TOOL_LIMIT = 3;
const SPEAK_MEMORY_TOOL_OVERFETCH = 12;

export type { SpeakToolClientEffect } from "@/lib/speak/types";

export type SpeakToolExecuteResult = {
  ok: boolean;
  error?: string;
  /** Payload the Realtime model should receive as the tool result. */
  modelResult: Record<string, unknown>;
  /** Side effects for the Speak UI (returned to the client). */
  clientEffects: SpeakToolClientEffect[];
};

function randomInstanceId(): string {
  return crypto.randomUUID();
}

export async function executeSpeakRealtimeTool(args: {
  userId: string;
  sessionId: string;
  name: string;
  argumentsJson: string;
  clerkUserId?: string;
  callId?: string;
}): Promise<SpeakToolExecuteResult> {
  const session = await getSpeakRealtimeSession(args.sessionId);

  if (!session || session.userId !== args.userId || session.status !== "active") {
    return {
      ok: false,
      error: "Session not found or closed",
      modelResult: { error: "Session not found or closed" },
      clientEffects: [],
    };
  }

  const budget = await assertSpeakBudgetOrClose({
    sessionId: args.sessionId,
    userId: args.userId,
  });

  if (!budget.ok || budget.shouldClose) {
    return {
      ok: false,
      error: budget.error ?? "Budget exhausted",
      modelResult: { error: budget.error ?? "Budget exhausted" },
      clientEffects: [],
    };
  }

  const nameParsed = SpeakToolNameSchema.safeParse(args.name);

  if (!nameParsed.success) {
    return {
      ok: false,
      error: "Unknown tool",
      modelResult: { error: "Unknown tool" },
      clientEffects: [],
    };
  }

  const toolName = nameParsed.data;

  const allowed = isToolAllowedForSession(toolName, {
    modalities: session.modalities,
    memoryEnabled: session.memoryEnabled === true,
    stage: session.stage,
  });

  if (!allowed) {
    return {
      ok: false,
      error: "Tool not enabled for this session",
      modelResult: { error: "Tool not enabled for this session" },
      clientEffects: [],
    };
  }

  let rawArgs: unknown = {};

  try {
    rawArgs = args.argumentsJson ? JSON.parse(args.argumentsJson) : {};
  } catch {
    return {
      ok: false,
      error: "Invalid tool arguments JSON",
      modelResult: { error: "Invalid tool arguments JSON" },
      clientEffects: [],
    };
  }

  if (toolName === "stage_turn") {
    const parsed = StageVoiceTurnSchema.safeParse(rawArgs);

    if (!parsed.success || !args.clerkUserId || !args.callId) return invalidArgs();
    const { checkStageLimit } = await import("@/lib/stage/limit");

    if (!(await checkStageLimit(args.userId, true)))
      return {
        ok: false,
        error: "Too many requests",
        modelResult: { error: "Too many requests" },
        clientEffects: [],
      };
    const { runStageTurn } = await import("@/lib/stage/turn");
    // Stable UUID per server tool call: a redelivery must not schedule the design twice.
    const hash = createHash("sha256").update(`${args.sessionId}:${args.callId}`).digest("hex");
    const requestId = `${hash.slice(0, 8)}-${hash.slice(8, 12)}-4${hash.slice(13, 16)}-8${hash.slice(17, 20)}-${hash.slice(20, 32)}`;

    try {
      const state = await runStageTurn(
        { ownerId: args.userId, clerkUserId: args.clerkUserId },
        parsed.data.message,
        requestId,
        session.stageSettings
      );
      const navigated = state.viewCommand?.id === requestId;
      const { stageViews } = await import("@/lib/stage/views");
      const selected = navigated
        ? stageViews(state).find(
            (entry) =>
              entry.view.kind === state.viewCommand!.target.kind &&
              entry.view.id === state.viewCommand!.target.id
          )
        : null;
      const newReply = state.messages.find(
        (message) => message.id === requestId && message.role === "user"
      )
        ? state.messages.findLast((message) => message.role === "assistant" && !message.author)
            ?.text
        : null;
      const reply = newReply ?? (selected ? `Showing ${selected.name}.` : undefined);

      return {
        ok: true,
        modelResult: {
          ok: true,
          reply,
          view: state.viewCommand?.target ?? null,
          revision: state.revision,
          designStatus: state.design?.status ?? null,
        },
        clientEffects: navigated ? [{ type: "stage_view", command: state.viewCommand! }] : [],
      };
    } catch {
      return {
        ok: false,
        error: "Stage could not finish this request. Please try again.",
        modelResult: {
          ok: false,
          error: "Stage could not finish this request. It may be busy; please try again.",
        },
        clientEffects: [],
      };
    }
  }

  return runSpeakTool({
    name: toolName,
    rawArgs,
    modalities: session.modalities,
    threadId: session.threadId,
    userId: args.userId,
  });
}

async function runSpeakTool(args: {
  name: Exclude<SpeakToolName, "stage_turn">;
  rawArgs: unknown;
  modalities: SpeakModalities;
  threadId: string | null;
  userId: string;
}): Promise<SpeakToolExecuteResult> {
  switch (args.name) {
    case "update_display_text": {
      const parsed = UpdateDisplayTextSchema.safeParse(args.rawArgs);

      if (!parsed.success) {
        return invalidArgs();
      }

      return {
        ok: true,
        modelResult: { ok: true },
        clientEffects: [{ type: "display_text", text: parsed.data.text }],
      };
    }
    case "render_gen_ui": {
      const parsed = RenderGenUiSchema.safeParse(args.rawArgs);

      if (!parsed.success) {
        return invalidArgs();
      }

      const instanceId = parsed.data.instanceId ?? randomInstanceId();

      return {
        ok: true,
        modelResult: { ok: true, instanceId },
        clientEffects: [{ type: "gen_ui", block: parsed.data.block, instanceId }],
      };
    }
    case "refresh_component": {
      const parsed = RefreshComponentSchema.safeParse(args.rawArgs);

      if (!parsed.success) {
        return invalidArgs();
      }

      return {
        ok: true,
        modelResult: { ok: true },
        clientEffects: [{ type: "refresh_component", instanceId: parsed.data.instanceId }],
      };
    }
    case "upsert_ui_state": {
      const parsed = UpsertUiStateSchema.safeParse(args.rawArgs);

      if (!parsed.success) {
        return invalidArgs();
      }

      return {
        ok: true,
        modelResult: { ok: true, count: parsed.data.items.length },
        clientEffects: [
          {
            type: "upsert_ui_state",
            surfaceId: parsed.data.surfaceId,
            items: parsed.data.items,
          },
        ],
      };
    }
    case "show_web_preview": {
      const parsed = ShowWebPreviewSchema.safeParse(args.rawArgs);

      if (!parsed.success) {
        return invalidArgs();
      }

      return {
        ok: true,
        modelResult: { ok: true },
        clientEffects: [
          {
            type: "web_preview",
            url: parsed.data.url,
            title: parsed.data.title,
          },
        ],
      };
    }
    case "search_memories": {
      const parsed = SearchMemoriesSchema.safeParse(args.rawArgs);

      if (!parsed.success) {
        return invalidArgs();
      }

      const query = parsed.data.query.trim();
      const run = await searchMemoriesWithL1Cache(args.userId, query, SPEAK_MEMORY_TOOL_OVERFETCH);

      if (run.result.error) {
        logger.warn("search_memories", `memory search failed: ${run.result.error}`);

        return {
          ok: false,
          error: run.result.error,
          modelResult: {
            ok: false,
            memories: [],
            count: 0,
            error: "Memory is unavailable right now",
          },
          clientEffects: [],
        };
      }

      const memories = selectMemoriesForPrompt(run.result.data?.results ?? [], {
        maxIncluded: SPEAK_MEMORY_TOOL_LIMIT,
        minScore: ARCADIA_MEMORY_MIN_SCORE,
      }).map((m) => m.memory);

      logger.log("search_memories", "memory_search_ok", {
        queryLength: query.length,
        cacheHit: run.metrics.cacheHit,
        searchMs: Math.round(run.metrics.memorySearchMs),
        count: memories.length,
      });

      return {
        ok: true,
        modelResult: { ok: true, memories, count: memories.length },
        clientEffects: [],
      };
    }
    case "update_thread_title": {
      const parsed = UpdateThreadTitleSchema.safeParse(args.rawArgs);

      if (!parsed.success) {
        return invalidArgs();
      }

      scheduleNanobot(args.threadId, "update_thread_title", async (threadId) => {
        await ensureChatHasTitle(threadId);
        if (parsed.data.hint) {
          logger.log("nanobot", `title hint: ${parsed.data.hint}`);
        }
      });

      return {
        ok: true,
        modelResult: { ok: true, scheduled: Boolean(args.threadId) },
        clientEffects: [],
      };
    }
    case "summarize_thread": {
      const parsed = SummarizeThreadSchema.safeParse(args.rawArgs);

      if (!parsed.success) {
        return invalidArgs();
      }

      scheduleNanobot(args.threadId, "summarize_thread", async (threadId) => {
        await updateChatSummary(threadId);
      });

      return {
        ok: true,
        modelResult: { ok: true, scheduled: Boolean(args.threadId) },
        clientEffects: [],
      };
    }
    default: {
      const _exhaustive: never = args.name;

      return {
        ok: false,
        error: `Unhandled tool ${_exhaustive}`,
        modelResult: { error: "Unhandled tool" },
        clientEffects: [],
      };
    }
  }
}

function invalidArgs(): SpeakToolExecuteResult {
  return {
    ok: false,
    error: "Invalid tool arguments",
    modelResult: { error: "Invalid tool arguments" },
    clientEffects: [],
  };
}

function scheduleNanobot(
  threadId: string | null,
  label: string,
  fn: (threadId: string) => Promise<unknown>
): void {
  if (!threadId) {
    logger.log("nanobot", `Skipped ${label}: no threadId`);

    return;
  }

  after(() => {
    void fn(threadId).catch((err) => {
      logger.warn(
        "nanobot",
        `${label} failed: ${err instanceof Error ? err.message : String(err)}`
      );
    });
  });
}

/** Re-export for tests. */
export const SpeakToolArgsProbe = z.object({}).passthrough();
