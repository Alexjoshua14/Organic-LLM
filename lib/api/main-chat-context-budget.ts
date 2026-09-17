import type { UIMessage } from "ai";
import type { ChatExperience } from "@/lib/chat/chat-experience";
import type { ChatStyle } from "@/lib/chat/chat-style";
import type { Logger } from "@/lib/logger";
import type { ContextEffortLevel } from "@/lib/memory/context-effort";

import { randomUUID } from "crypto";

import {
  appendMainChatPostToolSystemFragments,
  wrapSystemPromptWithResponseLength,
} from "@/lib/api/chat-system-prompt";
import { loadMainChatTurnContext, getContextMessageLimit } from "@/lib/api/chat-turn-context";
import { loadArcadiaChatTurnContext } from "@/lib/api/arcadia-chat-turn-context";
import { resolveChatModelId } from "@/lib/api/resolve-chat-model";
import {
  type ContextBudgetEstimate,
  type ContextBudgetLastTurn,
  type ContextBudgetScaffold,
  type ContextBudgetSegment,
  filterBudgetSegments,
  finalizeContextBudget,
  getMessageTextForTokenEstimate,
  getMessageToolPartsForTokenEstimate,
} from "@/lib/chat/context-budget";
import { estimateTokenCount } from "@/lib/llm/chat-helpers";
import { compileChatTools } from "@/lib/llm/compile-chat-tools";
import { createLogger } from "@/lib/logger";
import { appendCurrentDate } from "@/lib/system-prompt/current-date";
import { estimatedMemoryContextTokensForEffort } from "@/lib/memory/context-effort";

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
  zeroDataRetention?: boolean;
  contextEffort?: ContextEffortLevel;
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

const MEMORY_BREAKDOWN_NAMES = new Set(["Memories", "User portrait", "Memory inventory"]);

function memoryBreakdownTokens(rows: Array<{ name: string; tokens: number }> | undefined): number {
  if (!rows) return 0;

  return rows.reduce(
    (sum, row) => (MEMORY_BREAKDOWN_NAMES.has(row.name) ? sum + row.tokens : sum),
    0
  );
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

async function sumToolPartTokens(messages: UIMessage[]): Promise<number> {
  let total = 0;

  for (const message of messages) {
    const serialized = getMessageToolPartsForTokenEstimate(message);
    const count = serialized ? await estimateTokenCount(serialized) : 0;

    total += count ?? 0;
  }

  return total;
}

/**
 * System / tools / summary / memory token split shared by full budget and scaffold.
 * Keeps poll, scaffold, and send paths from drifting.
 * Callers that estimate memory (poll/scaffold) must inject the estimate into tokenBreakdown first.
 */
export async function resolveScaffoldSegmentTokens(params: {
  contextSystemPrompt: string;
  finalSystemPrompt: string;
  toolInstructions: string;
  tokenBreakdown?: Array<{ name: string; tokens: number }>;
}): Promise<{
  systemTokens: number;
  toolsTokens: number;
  summaryTokens: number;
  memoryTokens: number;
}> {
  const { contextSystemPrompt, finalSystemPrompt, toolInstructions, tokenBreakdown } = params;

  const [toolTokens, contextPackTokens, finalSystemTokens] = await Promise.all([
    estimateTokenCount(toolInstructions),
    estimateTokenCount(contextSystemPrompt),
    estimateTokenCount(finalSystemPrompt),
  ]);

  const baseSystemTokens = breakdownTokens(tokenBreakdown, "System Prompt");
  const summaryTokens = breakdownTokens(tokenBreakdown, "Conversation Summary");
  const memoryTokens = memoryBreakdownTokens(tokenBreakdown);

  const trackedContext = baseSystemTokens + summaryTokens + memoryTokens;
  const contextOverhead = Math.max(0, (contextPackTokens ?? 0) - trackedContext);
  const responseWrapTokens = Math.max(
    0,
    (finalSystemTokens ?? 0) - (contextPackTokens ?? 0) - (toolTokens ?? 0)
  );
  const systemTokens = baseSystemTokens + contextOverhead + responseWrapTokens;

  return {
    systemTokens,
    toolsTokens: toolTokens ?? 0,
    summaryTokens,
    memoryTokens,
  };
}

function finalizeBudgetEstimate(params: {
  modelId: string;
  resolvedModelId?: string;
  segments: ContextBudgetSegment[];
  contextMessageLimit?: number;
  packedMessageCount: number;
  totalThreadMessages: number;
  includesRollingSummary: boolean;
  reservedOutputTokens?: number;
  activeToolNames?: string[];
  memoriesInjected?: number;
  lastTurn?: ContextBudgetLastTurn;
}): ContextBudgetEstimate {
  const {
    modelId,
    resolvedModelId,
    segments,
    contextMessageLimit,
    packedMessageCount,
    totalThreadMessages,
    includesRollingSummary,
    reservedOutputTokens,
    activeToolNames,
    memoriesInjected,
    lastTurn,
  } = params;

  return finalizeContextBudget({
    modelId,
    resolvedModelId,
    segments,
    contextMessageLimit: contextMessageLimit ?? packedMessageCount,
    packedMessageCount,
    totalThreadMessages,
    includesRollingSummary,
    reservedOutputTokens,
    activeToolNames,
    memoriesInjected,
    lastTurn,
    source: "server",
  });
}

/**
 * Build a budget snapshot from an already-assembled turn (avoids duplicate getContext).
 */
export async function buildBudgetFromAssembledTurn(params: {
  modelId: string;
  resolvedModelId?: string;
  draftMessage: UIMessage;
  validatedMessages: UIMessage[];
  contextSystemPrompt: string;
  finalSystemPrompt: string;
  toolInstructions: string;
  activeToolNames?: string[];
  tokenBreakdown?: Array<{ name: string; tokens: number }>;
  packedMessageCount?: number;
  totalThreadMessages?: number;
  contextMessageLimit?: number;
  memoriesInjected?: number;
  /** Stamp `lastTurn` — only for a real LLM send, never poll/scaffold. */
  recordLastTurn?: boolean;
}): Promise<ContextBudgetEstimate> {
  const {
    modelId,
    resolvedModelId,
    draftMessage,
    validatedMessages,
    contextSystemPrompt,
    finalSystemPrompt,
    toolInstructions,
    activeToolNames,
    tokenBreakdown,
    packedMessageCount,
    totalThreadMessages,
    contextMessageLimit,
    memoriesInjected,
    recordLastTurn = false,
  } = params;

  const historyMessages = validatedMessages.slice(0, -1);

  const [messagesTokens, toolOutputTokens, draftTokens, scaffoldTokens] = await Promise.all([
    sumMessageTokens(historyMessages),
    sumToolPartTokens(historyMessages),
    sumMessageTokens([draftMessage]),
    resolveScaffoldSegmentTokens({
      contextSystemPrompt,
      finalSystemPrompt,
      toolInstructions,
      tokenBreakdown,
    }),
  ]);

  const segments = filterBudgetSegments([
    {
      id: "messages",
      label: "Thread messages",
      tokens: messagesTokens,
      color: "hsl(38 92% 50% / 0.88)",
    },
    {
      id: "tool_output",
      label: "Tool outputs",
      tokens: toolOutputTokens,
      color: "hsl(32 88% 48% / 0.86)",
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
      tokens: scaffoldTokens.systemTokens,
      color: "hsl(199 89% 48% / 0.82)",
    },
    {
      id: "tools",
      label: "Tools & instructions",
      tokens: scaffoldTokens.toolsTokens,
      color: "hsl(24 95% 53% / 0.82)",
    },
    {
      id: "summary",
      label: "Rolling summary",
      tokens: scaffoldTokens.summaryTokens,
      color: "hsl(262 83% 58% / 0.78)",
    },
    {
      id: "memory",
      label: "Memory layer",
      tokens: scaffoldTokens.memoryTokens,
      color: "hsl(280 75% 55% / 0.78)",
    },
  ]);

  const resolvedPacked = packedMessageCount ?? historyMessages.length;
  const resolvedTotal = totalThreadMessages ?? Math.max(resolvedPacked, historyMessages.length);

  const estimate = finalizeBudgetEstimate({
    modelId,
    resolvedModelId,
    segments,
    contextMessageLimit,
    packedMessageCount: resolvedPacked,
    totalThreadMessages: resolvedTotal,
    includesRollingSummary:
      scaffoldTokens.summaryTokens > 0 ||
      (contextMessageLimit != null && resolvedTotal > contextMessageLimit),
    activeToolNames,
    memoriesInjected,
  });

  if (!recordLastTurn) return estimate;

  return {
    ...estimate,
    lastTurn: {
      inputTokens: estimate.nextSubmitTokens,
      memoryTokens: scaffoldTokens.memoryTokens,
      memoriesInjected: memoriesInjected ?? 0,
    },
  };
}

async function assembleTurnPromptsAndTools(params: {
  log: Logger;
  chatId: string;
  sbUserId: string;
  draftText: string;
  memoryEnabled: boolean;
  webSearch: boolean;
  messageSearch: boolean;
  knowledgeSearch: boolean;
  experience?: ChatExperience;
  chatStyle?: ChatStyle;
  speechFriendly?: boolean;
  scaffoldMode?: boolean;
  contextEffort?: ContextEffortLevel;
}) {
  const {
    log,
    chatId,
    sbUserId,
    draftText,
    memoryEnabled,
    webSearch,
    messageSearch,
    knowledgeSearch,
    experience,
    chatStyle,
    speechFriendly,
    scaffoldMode = false,
    contextEffort,
  } = params;

  const draftMessage = buildDraftUserMessage(draftText);

  // Budget/scaffold polls must not hit Mem0/Ollama. Turn loaders skip memory; tool schemas still
  // reflect the caller's toggle; memory-layer tokens use the constant estimate.
  const turnContext = scaffoldMode
    ? await loadMainChatTurnContext({
        logger: log,
        chatId,
        message: draftMessage,
        memoryEnabled: false,
        experience,
        messagesOverride: [],
        totalThreadMessagesOverride: 0,
      })
    : experience === "arcadia"
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

  const { tools, toolInstructions } = await compileChatTools({
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

  const activeToolNames = Object.keys(tools);

  let systemPromptForRequest = appendMainChatPostToolSystemFragments({
    systemPromptForRequest: turnContext.systemPromptForRequest,
    hasTools: toolInstructions.length > 0,
    toolInstructions,
    speechFriendly,
    experience,
    chatStyle,
  });

  systemPromptForRequest = appendCurrentDate(
    wrapSystemPromptWithResponseLength(systemPromptForRequest, {
      experience,
    })
  );

  const tokenBreakdown = [...(turnContext.tokenBreakdown ?? [])];

  if (memoryEnabled) {
    const memoryTokens = estimatedMemoryContextTokensForEffort(contextEffort);
    const memoryIndex = tokenBreakdown.findIndex((row) => row.name === "Memories");

    if (memoryIndex >= 0) {
      tokenBreakdown[memoryIndex] = {
        name: "Memories",
        tokens: memoryTokens,
      };
    } else {
      tokenBreakdown.push({
        name: "Memories",
        tokens: memoryTokens,
      });
    }
  }

  return {
    draftMessage,
    turnContext,
    toolInstructions,
    activeToolNames,
    systemPromptForRequest,
    tokenBreakdown,
  };
}

/**
 * Numbers-only scaffold for client compose. One summary DB query; no message load.
 */
export async function assembleMainChatContextScaffold(
  params: AssembleMainChatContextBudgetParams
): Promise<ContextBudgetScaffold> {
  const {
    logger: log = logger,
    chatId,
    sbUserId,
    memoryEnabled = true,
    webSearch = true,
    messageSearch = true,
    knowledgeSearch = false,
    experience,
    chatStyle,
    speechFriendly,
    contextMessageLimit = 10,
    contextEffort,
  } = params;

  const assembled = await assembleTurnPromptsAndTools({
    log,
    chatId,
    sbUserId,
    draftText: "",
    memoryEnabled,
    webSearch,
    messageSearch,
    knowledgeSearch,
    experience,
    chatStyle,
    speechFriendly,
    scaffoldMode: true,
    contextEffort,
  });

  const scaffoldTokens = await resolveScaffoldSegmentTokens({
    contextSystemPrompt: assembled.turnContext.systemPromptForRequest,
    finalSystemPrompt: assembled.systemPromptForRequest,
    toolInstructions: assembled.toolInstructions,
    tokenBreakdown: assembled.tokenBreakdown,
  });

  const limit =
    experience === "arcadia"
      ? undefined
      : (contextMessageLimit ?? getContextMessageLimit(experience));

  return {
    systemTokens: scaffoldTokens.systemTokens,
    toolsTokens: scaffoldTokens.toolsTokens,
    summaryTokens: scaffoldTokens.summaryTokens,
    memoryTokens: scaffoldTokens.memoryTokens,
    memoriesInjected: assembled.turnContext.memoriesInjected,
    activeToolNames: assembled.activeToolNames,
    contextMessageLimit: limit,
    source: "server",
  };
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
    zeroDataRetention = false,
    contextEffort,
  } = params;

  const resolvedModelId = resolveChatModelId({
    modelId,
    draftText,
    experience,
    zeroDataRetention,
  });

  const assembled = await assembleTurnPromptsAndTools({
    log,
    chatId,
    sbUserId,
    draftText,
    memoryEnabled,
    webSearch,
    messageSearch,
    knowledgeSearch,
    experience,
    chatStyle,
    speechFriendly,
    contextEffort,
  });

  return buildBudgetFromAssembledTurn({
    modelId,
    resolvedModelId,
    draftMessage: assembled.draftMessage,
    validatedMessages: assembled.turnContext.validatedMessages,
    contextSystemPrompt: assembled.turnContext.systemPromptForRequest,
    finalSystemPrompt: assembled.systemPromptForRequest,
    toolInstructions: assembled.toolInstructions,
    activeToolNames: assembled.activeToolNames,
    tokenBreakdown: assembled.tokenBreakdown,
    packedMessageCount: assembled.turnContext.packedMessageCount,
    totalThreadMessages: assembled.turnContext.totalThreadMessages,
    contextMessageLimit: experience === "arcadia" ? undefined : contextMessageLimit,
    memoriesInjected: assembled.turnContext.memoriesInjected,
  });
}
