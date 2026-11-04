import type { GatewayProviderOptions } from "@ai-sdk/gateway";
import type { ModelMessage } from "ai";
import type { ChatEffortLevel } from "@/lib/schemas/chat-effort";

import { smoothStream, streamText } from "ai";

import { GENERIC_SERVER_ERROR, logRouteError } from "@/lib/api/client-safe-error";
import { BTW_SYSTEM_PROMPT } from "@/lib/chat/btw-context";
import { CHAT_STREAM_CHUNKING } from "@/lib/llm/chat-stream-chunking";
import { createLogger } from "@/lib/logger";
import { createLlmBudgetHooks } from "@/lib/plans/llm-budget-hooks";
import { buildEffortProviderOptions } from "@/lib/schemas/chat-effort";
import { appendCurrentDate } from "@/lib/system-prompt/current-date";
import { gatewayAttribution } from "@/lib/usage/gateway-attribution";

const logger = createLogger("lib/api/run-btw-stream.ts");

/** Side answers stay short; the main thread is where long work happens. */
const BTW_MAX_OUTPUT_TOKENS = 2_000;

export type RunBtwStreamParams = {
  sbUserId: string;
  clerkUserId: string;
  modelId: string;
  effort: ChatEffortLevel | undefined;
  zeroDataRetention: boolean;
  snapshotText: string;
  messages: ModelMessage[];
};

/**
 * Streams a `/btw` answer: no tools, the thread snapshot in the instructions, and the same
 * plan budget, ZDR, and gateway attribution as a main chat turn.
 */
export function runBtwStream(params: RunBtwStreamParams): Response {
  const { sbUserId, clerkUserId, modelId, effort, zeroDataRetention } = params;

  const result = streamText({
    ...createLlmBudgetHooks({
      ownerId: sbUserId,
      clerkUserId,
      modelId,
      operation: "btw",
      route: "/api/chat/[id]/btw",
    }),
    model: modelId,
    instructions: appendCurrentDate(
      `${BTW_SYSTEM_PROMPT}\n\n<conversation_snapshot>\n${params.snapshotText}\n</conversation_snapshot>`
    ),
    messages: params.messages,
    maxOutputTokens: BTW_MAX_OUTPUT_TOKENS,
    experimental_transform: smoothStream({ delayInMs: 20, chunking: CHAT_STREAM_CHUNKING }),
    providerOptions: {
      ...buildEffortProviderOptions(modelId, effort),
      gateway: {
        zeroDataRetention,
        ...gatewayAttribution({ userId: sbUserId, operation: "btw" }),
      } satisfies GatewayProviderOptions,
    },
    onError({ error }) {
      logRouteError(logger, "runBtwStream", error);
    },
  });

  // Same Redis token/cost counters as a main turn, so the rate limiters see side spend too.
  void Promise.resolve(result.totalUsage)
    .then(async (usage) => {
      if (!usage) return;

      try {
        const { recordLlmCost, recordLlmTokenUsage } = await import("@/lib/rate-limit/llm");

        await recordLlmTokenUsage(sbUserId, usage.totalTokens ?? 0);
        await recordLlmCost(sbUserId, modelId, {
          inputTokens: usage.inputTokens ?? 0,
          outputTokens: usage.outputTokens ?? 0,
          cachedInputTokens: usage.inputTokenDetails.cacheReadTokens ?? 0,
        });
      } catch {
        /* optional Redis cost/token recording */
      }
    })
    .catch(() => {
      /* optional — usage may be unavailable on abort */
    });

  return result.toUIMessageStreamResponse({
    sendReasoning: false,
    onError: (error) => {
      logRouteError(logger, "runBtwStream:response", error);

      return GENERIC_SERVER_ERROR;
    },
  });
}
