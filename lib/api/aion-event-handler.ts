import type { AionEventResponse } from "@/lib/schemas/aion-presence";
import type { Usage } from "@/lib/rate-limit/llm-cost";

import { randomUUID } from "crypto";

import { generateText, type LanguageModelUsage } from "ai";

import { persistAionPresenceTurns } from "@/lib/aion/presence/persist-turns";
import { resolveFeatureThread } from "@/lib/chat/resolve-feature-thread";
import { formatSessionContext, loadSessionContext } from "@/lib/llm/session-context";
import { createLogger } from "@/lib/logger";
import {
  checkAionPresenceTurn,
  getAionPresenceMaxOutputTokens,
  recordAionPresenceUsage,
} from "@/lib/rate-limit/aion-presence";
import { checkLlmMessageLimit } from "@/lib/rate-limit/llm";
import {
  AION_THREAD_FEATURE,
  AION_THREAD_PATH,
  AionEventRequestSchema,
} from "@/lib/schemas/aion-presence";
import { models } from "@/lib/schemas/chat-models";
import {
  buildAionPresenceSystemPrompt,
  isAionPresenceSilentReply,
} from "@/lib/system-prompt/aion-presence";

const logger = createLogger("lib/api/aion-event-handler.ts");

/** Preamble budget for a presence micro-turn — smaller than Speak's because turns are brief. */
export const AION_PRESENCE_CONTEXT_MAX_TOKENS = 1_200;
export const AION_PRESENCE_CONTEXT_RECENT_TURNS = 4;
export const AION_PRESENCE_CONTEXT_TURN_MAX_CHARS = 300;
export const AION_PRESENCE_CONTEXT_SUMMARY_MAX_CHARS = 1_200;
export const AION_PRESENCE_CONTEXT_MEMORY_LIMIT = 4;
export const AION_PRESENCE_CONTEXT_MEMORY_OVERFETCH = 10;

const DEFAULT_PRESENCE_MODEL = models.openai.oss20b;

export type AionEventDeps = {
  auth: (...args: any[]) => Promise<any>;
  getSupabaseUserId: (clerkUserId: string) => Promise<{ data: string | null; error: Error | null }>;
  checkLlmMessageLimit: typeof checkLlmMessageLimit;
  checkAionPresenceTurn: typeof checkAionPresenceTurn;
  recordAionPresenceUsage: typeof recordAionPresenceUsage;
  resolveFeatureThread: typeof resolveFeatureThread;
  loadSessionContext: typeof loadSessionContext;
  formatSessionContext: typeof formatSessionContext;
  generateText: typeof generateText;
  persistAionPresenceTurns: typeof persistAionPresenceTurns;
  /** Schedule post-process work (title/summary). Production wires `after` from next/server. */
  after: (fn: () => void) => void;
  now?: () => number;
  randomId?: () => string;
};

function usageFromGenerateText(usage: LanguageModelUsage | undefined): Usage {
  return {
    inputTokens: usage?.inputTokens ?? 0,
    outputTokens: usage?.outputTokens ?? 0,
    cachedInputTokens:
      (usage as { cachedInputTokens?: number } | undefined)?.cachedInputTokens ?? 0,
  };
}

export function createAionEventHandler(deps: AionEventDeps) {
  return async function POST(req: Request): Promise<Response> {
    let json: unknown;

    try {
      json = await req.json();
    } catch {
      return Response.json({ error: "Invalid request body" }, { status: 400 });
    }

    const parseResult = AionEventRequestSchema.safeParse(json);

    if (!parseResult.success) {
      logger.error("POST", "Invalid request body: validation_failed");

      return Response.json({ error: "Invalid request body" }, { status: 400 });
    }

    const body = parseResult.data;
    const clerkUser = await deps.auth();

    if (!clerkUser || !clerkUser.userId) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const sbUserIdResult = await deps.getSupabaseUserId(clerkUser.userId);

    if (sbUserIdResult.error || sbUserIdResult.data === null) {
      return Response.json({ error: "User not found" }, { status: 404 });
    }

    const sbUserId = sbUserIdResult.data;

    const messageLimitResult = await deps.checkLlmMessageLimit(sbUserId);

    if (!messageLimitResult.success) {
      return Response.json(
        { error: messageLimitResult.error ?? "Too many requests" },
        { status: 429 }
      );
    }

    const presenceCheck = await deps.checkAionPresenceTurn(sbUserId);

    if (!presenceCheck.success) {
      const denied: AionEventResponse = {
        text: null,
        silent: true,
        threadId: body.threadId ?? null,
        budget: presenceCheck.budget,
        error: presenceCheck.error,
      };

      return Response.json(denied, { status: 429 });
    }

    const thread = await deps.resolveFeatureThread({
      ownerId: sbUserId,
      feature: AION_THREAD_FEATURE,
      path: AION_THREAD_PATH,
      policy: body.threadPolicy,
      requestedThreadId: body.threadId,
    });

    if (!thread.threadId) {
      return Response.json(
        {
          error: thread.error ?? "Failed to resolve Aion thread",
          text: null,
          silent: true,
          threadId: null,
        },
        { status: 500 }
      );
    }

    const limits = {
      maxTokens: AION_PRESENCE_CONTEXT_MAX_TOKENS,
      recentTurns: AION_PRESENCE_CONTEXT_RECENT_TURNS,
      turnMaxChars: AION_PRESENCE_CONTEXT_TURN_MAX_CHARS,
      summaryMaxChars: AION_PRESENCE_CONTEXT_SUMMARY_MAX_CHARS,
      memoryLimit: AION_PRESENCE_CONTEXT_MEMORY_LIMIT,
      memoryOverfetch: AION_PRESENCE_CONTEXT_MEMORY_OVERFETCH,
    };

    let sessionContext: string | null = null;

    if (thread.resumed) {
      const loaded = await deps.loadSessionContext({
        ownerId: sbUserId,
        threadId: thread.threadId,
        memoryEnabled: body.memory === true,
        limits,
      });

      sessionContext = deps.formatSessionContext(loaded, limits) || null;
    }

    const system = buildAionPresenceSystemPrompt({
      sessionContext,
      resumed: thread.resumed,
      ledger: body.ledger,
      event: body.event,
    });

    const modelId =
      body.modelId && body.modelId.length > 0 ? body.modelId : DEFAULT_PRESENCE_MODEL.id;
    const maxOutputTokens = getAionPresenceMaxOutputTokens();
    const startedAt = (deps.now ?? Date.now)();
    const randomId = deps.randomId ?? randomUUID;

    let rawText = "";
    let usage: Usage = { inputTokens: 0, outputTokens: 0 };

    try {
      const result = await deps.generateText({
        model: modelId,
        system,
        prompt: "Respond to the current event. Reply with exactly [silent] if no reply is needed.",
        maxOutputTokens,
      });

      rawText = result.text ?? "";
      usage = usageFromGenerateText(result.usage);
    } catch (err) {
      const e = err instanceof Error ? err : new Error(String(err));

      logger.error("POST", `generateText failed: ${e.message}`);

      return Response.json(
        {
          error: "Presence micro-turn failed",
          text: null,
          silent: true,
          threadId: thread.threadId,
          budget: presenceCheck.budget,
        },
        { status: 500 }
      );
    }

    const durationMs = (deps.now ?? Date.now)() - startedAt;
    const silent = isAionPresenceSilentReply(rawText);
    const replyText = silent ? null : rawText.trim();

    const { costUsd, budget } = await deps.recordAionPresenceUsage({
      userId: sbUserId,
      modelId,
      usage,
    });

    const eventMessageId = randomId();
    const replyMessageId = randomId();

    const persist = await deps.persistAionPresenceTurns({
      threadId: thread.threadId,
      event: body.event,
      eventMessageId,
      replyText,
      replyMessageId,
    });

    if (persist.ok) {
      deps.after(() => {
        void persist.postProcess().catch((err) => {
          logger.warn(
            "POST",
            `post-process failed: ${err instanceof Error ? err.message : String(err)}`
          );
        });
      });
    } else {
      logger.warn("POST", `persist failed: ${persist.error}`);
    }

    const response: AionEventResponse = {
      text: replyText,
      silent,
      threadId: thread.threadId,
      resumed: thread.resumed,
      budget,
      usage: {
        inputTokens: usage.inputTokens,
        outputTokens: usage.outputTokens,
        totalTokens: (usage.inputTokens ?? 0) + (usage.outputTokens ?? 0),
        durationMs,
        modelId,
        costUsd,
      },
    };

    logger.log(
      "POST",
      `presence micro-turn silent=${silent} tokens=${response.usage?.totalTokens ?? 0} ms=${durationMs}`
    );

    return Response.json(response);
  };
}
