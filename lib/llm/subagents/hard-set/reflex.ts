import type { LanguageModelUsage } from "ai";
import type { HardSetSubagent } from "@/lib/llm/subagents/hard-set/types";

import { experimental_decide as decide } from "ai";

import {
  jevRouterCallConfig,
  type JevZdrProviderOptions,
} from "@/lib/llm/subagents/orchestrator/router-zdr";
import { createLogger } from "@/lib/logger";
import { gatewayAttribution } from "@/lib/usage/gateway-attribution";

const logger = createLogger("lib/llm/subagents/hard-set/reflex.ts");

/**
 * Reflex only when Jev is this sure. Higher than the heartbeat's 0.8: a wrong reflex answers a
 * real question with a menu, while a wrong pass-through just costs one normal turn.
 */
export const HELP_REFLEX_CONFIDENCE = 0.85;

/** Jev runs alongside context loading; past this the turn passes through instead of waiting. */
export const HELP_REFLEX_TIMEOUT_MS = 2_500;

/**
 * Messages longer than this pass through without asking Jev — a help request or "I'm not sure
 * what to do" is short. Only ever skips toward the normal path, never toward the reflex.
 */
export const HELP_REFLEX_MAX_CHARS = 400;

export const JEV_HELP_REFLEX_QUESTION = `You gate messages sent to a specialist AI subagent. Decide whether the user's message needs no intelligence to answer: they are only asking for help, what the subagent can do, how to use it, or they say they are unsure what to do — with no specific task, question, or content to work on.

Answer true only for those messages, e.g. "help", "what can you do?", "how does this work?", "I'm not sure where to start".
Answer false whenever the message asks for anything that needs reasoning, knowledge, or work — even if it also asks for help — e.g. "help me design X", "what can you do about my latency problem?", "how would you structure this API?", a pasted document, or any follow-up on earlier work.

Is this message only a request for help or orientation, needing no reasoning to answer?`;

export type HelpReflexDecision = {
  reflex: boolean;
  /** Why: Jev's call, or the reason Jev was skipped / failed (always pass-through). */
  reason: "jev" | "empty" | "too-long" | "has-attachments" | "timeout-or-error";
  probability?: number;
  modelId?: string;
  usage?: LanguageModelUsage;
  providerMetadata?: unknown;
};

export type JevHelpReflexDecide = (args: {
  model: string;
  question: string;
  state: string;
  providerOptions: JevZdrProviderOptions;
  abortSignal: AbortSignal;
}) => Promise<{ probability: number; usage?: LanguageModelUsage; providerMetadata?: unknown }>;

const defaultDecide: JevHelpReflexDecide = async (args) => {
  const result = await decide({
    model: args.model,
    state: args.state,
    questions: { help: { type: "boolean" as const, instructions: args.question } },
    providerOptions: args.providerOptions,
    abortSignal: args.abortSignal,
  });
  const answer = result.answers.help;

  // `decide` may omit token details; the usage recorder reads them.
  const usage: LanguageModelUsage = {
    inputTokenDetails: {
      noCacheTokens: undefined,
      cacheReadTokens: undefined,
      cacheWriteTokens: undefined,
    },
    outputTokenDetails: { textTokens: undefined, reasoningTokens: undefined },
    ...result.usage,
  };

  return {
    probability: answer?.type === "boolean" ? answer.probability : 0,
    usage,
    providerMetadata: result.providerMetadata,
  };
};

/**
 * Jev (ZDR forced) decides whether a shell message gets the subagent's reflexive help menu or
 * passes through to the normal chat turn. Every failure passes through. Never throws.
 */
export async function classifyHelpReflex(args: {
  text: string;
  agent: Pick<HardSetSubagent, "name" | "role">;
  ownerId: string;
  decide?: JevHelpReflexDecide;
  timeoutMs?: number;
}): Promise<HelpReflexDecision> {
  const text = args.text.trim();

  if (!text) return { reflex: false, reason: "empty" };
  if (text.length > HELP_REFLEX_MAX_CHARS) return { reflex: false, reason: "too-long" };

  const call = jevRouterCallConfig();
  const providerOptions: JevZdrProviderOptions = {
    gateway: {
      ...call.providerOptions.gateway,
      ...gatewayAttribution({ userId: args.ownerId, operation: "subagent_reflex" }),
    },
  };

  try {
    const result = await (args.decide ?? defaultDecide)({
      model: call.model,
      question: JEV_HELP_REFLEX_QUESTION,
      // Only the latest message and who it is addressed to — nothing else leaves the server.
      state: `Subagent: ${args.agent.name} (${args.agent.role})\nUser message:\n${text}`,
      providerOptions,
      abortSignal: AbortSignal.timeout(args.timeoutMs ?? HELP_REFLEX_TIMEOUT_MS),
    });

    return {
      reflex: result.probability > HELP_REFLEX_CONFIDENCE,
      reason: "jev",
      probability: result.probability,
      modelId: call.model,
      usage: result.usage,
      providerMetadata: result.providerMetadata,
    };
  } catch (err) {
    logger.warn("classifyHelpReflex", "Jev reflex check failed — passing through", {
      error: err instanceof Error ? err.message : String(err),
    });

    return { reflex: false, reason: "timeout-or-error" };
  }
}
