import type { UIMessage } from "ai";
import type { Logger } from "@/lib/logger";
import type { Result } from "@/types";
import type { ChatModel } from "@/lib/schemas/chat";
import type {
  JevAnalysis,
  JevModelRoute,
  JevPlan,
  JevTurnData,
} from "@/lib/arcadia/jev/types";

import { getNMessages } from "@/data/supabase/chat";
import { getLastUserMessageText } from "@/lib/arcadia/help-response";
import {
  analyzeWithJev,
  fallbackJevAnalysis,
  toJevConversationTurns,
} from "@/lib/arcadia/jev/analyze";
import { JEV_INPUT_TOO_LARGE_MESSAGE, JEV_RECENT_MESSAGES } from "@/lib/arcadia/jev/constants";
import { prepareJevInput, type PreparedJevInput } from "@/lib/arcadia/jev/input";
import { getJevModelRoutingMode, routeAutoModelWithJev } from "@/lib/arcadia/jev/model-routing";
import { resolveJevOverride } from "@/lib/arcadia/jev/override";
import { buildJevTurnData, planJevTurn, type JevToolPermissions } from "@/lib/arcadia/jev/plan";
import { chatModelById } from "@/lib/schemas/chat";
import { buildJevSystemFragment } from "@/lib/system-prompt/jev";

/**
 * Arcadia Jev mode glue for `/api/chat`. Jev reads the user's message before the LLM does; see
 * docs/architecture/decisions/20261001-arcadia-jev-mode.md.
 *
 * Order in the route:
 * 1. {@link arcadiaJevPreflight} — before anything is saved: refuse oversized input, validate and
 *    consume a "Respond anyway" override.
 * 2. {@link startArcadiaJevWork} — inside the stream, in parallel with context loading: the Jev
 *    analysis and, when the composer model is Auto, Jev-assisted model routing.
 * 3. {@link decideArcadiaJevTurn} — turn the analysis into a plan: acknowledge or respond, tools,
 *    reply format, and the system prompt fragment.
 */

export type ArcadiaJevPreflight = {
  input: Extract<PreparedJevInput, { ok: true }>;
  /** Set when the user pressed "Respond anyway": the decision stored on the acknowledgement. */
  override: { analysis: JevAnalysis; route?: JevModelRoute } | null;
};

function jsonError(status: number, error: string): Response {
  return new Response(JSON.stringify({ error, status }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/**
 * 413 for input over the 1M-token cap; 409 when an override no longer points at the latest
 * message. Runs after auth so unauthenticated requests never reach the tokenizer.
 */
export async function arcadiaJevPreflight(params: {
  chatId: string;
  message: UIMessage;
  overrideMessageId?: string;
  logger: Logger;
}): Promise<Result<ArcadiaJevPreflight, Response>> {
  const { chatId, message, overrideMessageId, logger } = params;
  const input = prepareJevInput(getLastUserMessageText(message));

  if (!input.ok) {
    logger.warn("arcadiaJevPreflight", "Jev input over the token cap", {
      tokens: input.tokenCount,
    });

    return { data: null, error: jsonError(413, JEV_INPUT_TOO_LARGE_MESSAGE) };
  }

  if (!overrideMessageId) {
    return { data: { input, override: null }, error: null };
  }

  const resolved = await resolveJevOverride({
    chatId,
    userMessageId: message.id,
    ackMessageId: overrideMessageId,
  });

  if (resolved.error || !resolved.data) {
    return {
      data: null,
      error: jsonError(409, resolved.error?.message ?? "Jev can't answer that message now."),
    };
  }

  return { data: { input, override: resolved.data }, error: null };
}

export type ArcadiaJevRouted = { model: ChatModel; route: JevModelRoute };

/**
 * Starts the Jev analysis and (for Auto) model routing. Both promises always resolve: analysis
 * falls back to Standard-Arcadia behavior, routing to `null` (keep the existing Auto pick).
 */
export function startArcadiaJevWork(params: {
  chatId: string;
  message: UIMessage;
  preflight: ArcadiaJevPreflight;
  /** Thread starter priming; Jev reads it as a standing note about the thread. */
  starterPriming: Promise<string | undefined>;
  /** Set only when the composer model is Auto. */
  autoRouting: { fallbackModel: ChatModel; zeroDataRetention: boolean } | null;
  logger: Logger;
}): { analysis: Promise<JevAnalysis>; routed: Promise<ArcadiaJevRouted | null> } {
  const { chatId, message, preflight, starterPriming, autoRouting, logger } = params;

  const analysis = preflight.override
    ? Promise.resolve(preflight.override.analysis)
    : (async () => {
        const [recent, threadPriming] = await Promise.all([
          // +1: the user message is saved optimistically and may already be in the table.
          getNMessages(chatId, JEV_RECENT_MESSAGES + 1),
          starterPriming,
        ]);
        const history = (recent.data ?? []).filter((m) => m.id !== message.id);

        return analyzeWithJev({
          input: preflight.input,
          recentConversation: toJevConversationTurns(history),
          threadPriming,
        });
      })().catch((err: unknown) => {
        logger.error("startArcadiaJevWork", "Jev analysis threw; using fallback", {
          err: err instanceof Error ? err.name : "unknown",
        });

        return fallbackJevAnalysis("error", preflight.input.tokenCount);
      });

  const routed = (async (): Promise<ArcadiaJevRouted | null> => {
    if (!autoRouting) return null;

    const mode = getJevModelRoutingMode();

    if (mode === "off") return null;

    // Respond anyway: reuse the pick made on the first send unless ZDR now rules it out.
    const stored = preflight.override?.route;
    const storedModel = stored ? chatModelById(stored.modelId) : undefined;

    if (
      stored &&
      storedModel &&
      !(autoRouting.zeroDataRetention && storedModel.supportsZeroDataRetention === false)
    ) {
      return { model: storedModel, route: stored };
    }

    return routeAutoModelWithJev({
      messageText: getLastUserMessageText(message),
      zeroDataRetention: autoRouting.zeroDataRetention,
      fallbackModel: autoRouting.fallbackModel,
      mode,
    });
  })().catch((err: unknown) => {
    logger.error("startArcadiaJevWork", "Jev routing threw; keeping the Auto pick", {
      err: err instanceof Error ? err.name : "unknown",
    });

    return null;
  });

  return { analysis, routed };
}

export type ArcadiaJevDecision = {
  plan: JevPlan;
  turnData: JevTurnData;
  /** Appended to the Arcadia system prompt when the turn goes to the LLM. */
  systemFragment: string;
};

export function decideArcadiaJevTurn(params: {
  analysis: JevAnalysis;
  route: JevModelRoute | undefined;
  permissions: JevToolPermissions;
  override: boolean;
}): ArcadiaJevDecision {
  const { analysis, route, permissions, override } = params;
  const plan = planJevTurn({ analysis, permissions, override });

  return {
    plan,
    turnData: buildJevTurnData({ analysis, plan, route }),
    systemFragment: buildJevSystemFragment({ analysis, plan }),
  };
}
