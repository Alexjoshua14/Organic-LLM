import "server-only";

import { after } from "next/server";
import { z } from "zod";

import { ensureChatHasTitle, updateChatSummary } from "@/lib/llm/chat-helpers";
import {
  isToolAllowedForModalities,
  RefreshComponentSchema,
  RenderGenUiSchema,
  ShowWebPreviewSchema,
  SpeakToolNameSchema,
  SummarizeThreadSchema,
  UpdateDisplayTextSchema,
  UpdateThreadTitleSchema,
  UpsertUiStateSchema,
  type SpeakToolName,
} from "@/lib/llm/compile-speak-tools";
import { createLogger } from "@/lib/logger";
import {
  assertSpeakBudgetOrClose,
  getSpeakRealtimeSession,
} from "@/lib/rate-limit/speak-realtime";
import type { SpeakModalities } from "@/lib/schemas/speak-modalities";
import type { SpeakToolClientEffect } from "@/lib/speak/types";

const logger = createLogger("lib/speak/execute-speak-tool.ts");

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
    minutesDelta: 0,
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

  if (!isToolAllowedForModalities(toolName, session.modalities)) {
    return {
      ok: false,
      error: "Tool disabled by modality toggles",
      modelResult: { error: "Tool disabled by modality toggles" },
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

  return runSpeakTool({
    name: toolName,
    rawArgs,
    modalities: session.modalities,
    threadId: session.threadId,
    userId: args.userId,
  });
}

async function runSpeakTool(args: {
  name: SpeakToolName;
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
