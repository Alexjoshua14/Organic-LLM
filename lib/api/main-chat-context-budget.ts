import type { UIMessage } from "ai";
import type { ChatExperience } from "@/lib/chat/chat-experience";
import type { ChatStyle } from "@/lib/chat/chat-style";
import type { Logger } from "@/lib/logger";

import { randomUUID } from "crypto";

import {
  appendMainChatPostToolSystemFragments,
  wrapSystemPromptWithResponseLength,
} from "@/lib/api/chat-system-prompt";
import { loadMainChatTurnContext } from "@/lib/api/chat-turn-context";
import { loadArcadiaChatTurnContext } from "@/lib/api/arcadia-chat-turn-context";
import {
  type ContextBudgetEstimate,
  type ContextBudgetSegment,
  ESTIMATED_MEMORY_CONTEXT_TOKENS,
  filterBudgetSegments,
  getMessageTextForTokenEstimate,
  getModelContextWindowTokens,
} from "@/lib/chat/context-budget";
import { CHAT_RESPONSE_MAX_OUTPUT_TOKENS } from "@/lib/llm/helpers";
import { estimateTokenCount } from "@/lib/llm/chat-helpers";
import { compileChatTools } from "@/lib/llm/compile-chat-tools";
import { createLogger } from "@/lib/logger";

const logger = createLogger("lib/api/main-chat-context-budget.ts");

export type AssembleMainChatContextBudgetParams = {
  logger?: Logger;
  chatId: string;
  sbUserId: string;
  draftText: string;
  modelId: string;
  memoryEnabled?: boolean;
  webSearch?: boolean;
  messageSearch?: boolean;
  knowledgeSearch?: boolean;
  experience?: ChatExperience;
  chatStyle?: ChatStyle;
  speechFriendly?: boolean;
  contextMessageLimit?: number;
};

export function buildDraftUserMessage(draftText: string): UIMessage {
  return {
    id: randomUUID(),
    role: "user",
    parts: [{ type: "text", text: draftText }],
  };
}

function breakdownTokens(
  rows: Array<{ name: string; tokens: number }> | undefined,
  label: string
): number {
  return rows?.find((row) => row.name === label)?.tokens ?? 0;
}

async function sumMessageTokens(messages: UIMessage[]): Promise<number> {
  let total = 0;

  for (const message of messages) {
    const text = getMessageTextForTokenEstimate(message);
    const count = text ? await estimateTokenCount(text) : 0;

    total += count ?? 0;
  }

  return total;
}

function finalizeBudgetEstimate(params: {
  modelId: string;
  segments: ContextBudgetSegment[];
  contextMessageLimit?: number;
  packedMessageCount: number;
  totalThreadMessages: number;
  includesRollingSummary: boolean;
  reservedOutputTokens?: number;
}): ContextBudgetEstimate {
  const {
    modelId,
    segments,
    contextMessageLimit,
    packedMessageCount,
    totalThreadMessages,
    includesRollingSummary,
    reservedOutputTokens = CHAT_RESPONSE_MAX_OUTPUT_TOKENS,
  } = params;

  const contextWindowTokens = getModelContextWindowTokens(modelId);
  const inputBudgetTokens = Math.max(0, contextWindowTokens - reservedOutputTokens);
  const usedSegments = segments.filter((segment) => segment.id !== "free");
  const nextSubmitTokens = usedSegments.reduce((sum, segment) => sum + segment.tokens, 0);
  const remainingInputTokens = Math.max(0, inputBudgetTokens - nextSubmitTokens);
  const fillRatio =
    inputBudgetTokens > 0 ? Math.min(1, nextSubmitTokens / inputBudgetTokens) : 0;

  const allSegments = [
    ...usedSegments,
    ...(remainingInputTokens > 0
      ? [
          {
            id: "free" as const,
            label: "Remaining",
            tokens: remainingInputTokens,
            color: "hsl(var(--muted-foreground) / 0.18)",
          },
        ]
      : []),
  ];

  return {
    modelId,
    contextWindowTokens,
    reservedOutputTokens,
    inputBudgetTokens,
    nextSubmitTokens,
    remainingInputTokens,
    fillRatio,
    contextMessageLimit: contextMessageLimit ?? packedMessageCount,
    packedMessageCount,
    totalThreadMessages,
    includesRollingSummary,
    segments: allSegments,
    source: "server",
  };
}

/**
 * Build a budget snapshot from an already-assembled turn (avoids duplicate getContext).
 */
export async function buildBudgetFromAssembledTurn(params: {
  modelId: string;
  draftMessage: UIMessage;
  validatedMessages: UIMessage[];
  contextSystemPrompt: string;
  finalSystemPrompt: string;
  toolInstructions: string;
  tokenBreakdown?: Array<{ name: string; tokens: number }>;
  packedMessageCount?: number;
  totalThreadMessages?: number;
  contextMessageLimit?: number;
}): Promise<ContextBudgetEstimate> {
  const {
    modelId,
    draftMessage,
    validatedMessages,
    contextSystemPrompt,
    finalSystemPrompt,
    toolInstructions,
    tokenBreakdown,
    packedMessageCount,
    totalThreadMessages,
    contextMessageLimit,
  } = params;

  const historyMessages = validatedMessages.slice(0, -1);

  const [messagesTokens, draftTokens, toolTokens, contextPackTokens, finalSystemTokens] =
    await Promise.all([
      sumMessageTokens(historyMessages),
      sumMessageTokens([draftMessage]),
      estimateTokenCount(toolInstructions),
      estimateTokenCount(contextSystemPrompt),
      estimateTokenCount(finalSystemPrompt),
    ]);

  const baseSystemTokens = breakdownTokens(tokenBreakdown, "System Prompt");
  const summaryTokens = breakdownTokens(tokenBreakdown, "Conversation Summary");
  const memoryTokens = breakdownTokens(tokenBreakdown, "Memories");
  const trackedContext = baseSystemTokens + summaryTokens + memoryTokens;
  const contextOverhead = Math.max(0, (contextPackTokens ?? 0) - trackedContext);
  const responseWrapTokens = Math.max(
    0,
    (finalSystemTokens ?? 0) - (contextPackTokens ?? 0) - (toolTokens ?? 0)
  );
  const systemTokens = baseSystemTokens + contextOverhead + responseWrapTokens;

  const segments = filterBudgetSegments([
    {
      id: "messages",
      label: "Thread messages",
      tokens: messagesTokens,
      color: "hsl(38 92% 50% / 0.88)",
    },
    {
      id: "draft",
      label: "Your draft",
      tokens: draftTokens,
      color: "hsl(152 68% 42% / 0.9)",
    },
    {
      id: "system",
      label: "System prompt",
      tokens: systemTokens,
      color: "hsl(199 89% 48% / 0.82)",
    },
    {
      id: "tools",
      label: "Tools & instructions",
      tokens: toolTokens ?? 0,
      color: "hsl(24 95% 53% / 0.82)",
    },
    {
      id: "summary",
      label: "Rolling summary",
      tokens: summaryTokens,
      color: "hsl(262 83% 58% / 0.78)",
    },
    {
      id: "memory",
      label: "Memory layer",
      tokens: memoryTokens,
      color: "hsl(280 75% 55% / 0.78)",
    },
  ]);

  const resolvedPacked = packedMessageCount ?? historyMessages.length;
  const resolvedTotal =
    totalThreadMessages ?? Math.max(resolvedPacked, historyMessages.length);

  return finalizeBudgetEstimate({
    modelId,
    segments,
    contextMessageLimit,
    packedMessageCount: resolvedPacked,
    totalThreadMessages: resolvedTotal,
    includesRollingSummary:
      summaryTokens > 0 ||
      (contextMessageLimit != null && resolvedTotal > contextMessageLimit),
  });
}

/**
 * Mirrors the main chat route's context assembly to estimate tokens for the next send.
 */
export async function assembleMainChatContextBudget(
  params: AssembleMainChatContextBudgetParams
): Promise<ContextBudgetEstimate> {
  const {
    logger: log = logger,
    chatId,
    sbUserId,
    draftText,
    modelId,
    memoryEnabled = true,
    webSearch = true,
    messageSearch = true,
    knowledgeSearch = false,
    experience,
    chatStyle,
    speechFriendly,
    contextMessageLimit = 10,
  } = params;

  const draftMessage = buildDraftUserMessage(draftText);

  // Budget polls must not hit Mem0/Ollama. Turn loaders skip memory; tool schemas still
  // reflect the caller's toggle; memory-layer tokens use the constant estimate.
  const turnContext =
    experience === "arcadia"
      ? await loadArcadiaChatTurnContext({
          logger: log,
          chatId,
          message: draftMessage,
          memoryEnabled: false,
        })
      : await loadMainChatTurnContext({
          logger: log,
          chatId,
          message: draftMessage,
          memoryEnabled: false,
          experience,
        });

  const { toolInstructions } = await compileChatTools({
    useSearch: webSearch,
    useMemory: memoryEnabled,
    useGetMoreMessages: messageSearch,
    useKnowledgeSearch: knowledgeSearch && experience === "strata_page",
    experience,
    chatStyle,
    chatId,
    initialMessageCount: turnContext.validatedMessages.length,
    sbUserId,
  });

  let systemPromptForRequest = appendMainChatPostToolSystemFragments({
    systemPromptForRequest: turnContext.systemPromptForRequest,
    hasTools: toolInstructions.length > 0,
    toolInstructions,
    speechFriendly,
    experience,
    chatStyle,
  });

  systemPromptForRequest = wrapSystemPromptWithResponseLength(systemPromptForRequest, {
    experience,
  });

  const tokenBreakdown = [...(turnContext.tokenBreakdown ?? [])];

  if (memoryEnabled) {
    const memoryIndex = tokenBreakdown.findIndex((row) => row.name === "Memories");

    if (memoryIndex >= 0) {
      tokenBreakdown[memoryIndex] = {
        name: "Memories",
        tokens: ESTIMATED_MEMORY_CONTEXT_TOKENS,
      };
    } else {
      tokenBreakdown.push({
        name: "Memories",
        tokens: ESTIMATED_MEMORY_CONTEXT_TOKENS,
      });
    }
  }

  return buildBudgetFromAssembledTurn({
    modelId,
    draftMessage,
    validatedMessages: turnContext.validatedMessages,
    contextSystemPrompt: turnContext.systemPromptForRequest,
    finalSystemPrompt: systemPromptForRequest,
    toolInstructions,
    tokenBreakdown,
    packedMessageCount: turnContext.packedMessageCount,
    totalThreadMessages: turnContext.totalThreadMessages,
    contextMessageLimit: experience === "arcadia" ? undefined : contextMessageLimit,
  });
}
