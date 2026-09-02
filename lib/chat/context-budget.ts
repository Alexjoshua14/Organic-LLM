import type { UIMessage } from "ai";
import type { ChatExperience } from "@/lib/chat/chat-experience";

import { encodingForModel } from "js-tiktoken";

import { resolveChatModelId } from "@/lib/api/resolve-chat-model";
import { CHAT_RESPONSE_MAX_OUTPUT_TOKENS } from "@/lib/llm/helpers";
import { AUTO_CHAT_MODEL_ID } from "@/lib/schemas/chat";

/** Approximate system prompt size (matches `SYSTEM_PROMPT` + guardrails). */
export const ESTIMATED_SYSTEM_PROMPT_TOKENS = 3_400;

/** Tool schema + instruction appendix overhead (main chat baseline). */
export const ESTIMATED_BASE_TOOL_TOKENS = 1_100;

export const ESTIMATED_WEB_SEARCH_TOOL_TOKENS = 750;
export const ESTIMATED_MEMORY_TOOL_TOKENS = 650;
export const ESTIMATED_MESSAGE_SEARCH_TOOL_TOKENS = 850;
/** Typical Mem0 hits merged into context when memory is on. */
export const ESTIMATED_MEMORY_CONTEXT_TOKENS = 900;
/** Rolling summary attached when the thread exceeds the last-N window. */
export const ESTIMATED_ROLLING_SUMMARY_BASE_TOKENS = 600;

const DEFAULT_CONTEXT_WINDOW_TOKENS = 128_000;

/** Known gateway model input windows (tokens). */
const MODEL_CONTEXT_WINDOW_TOKENS: Record<string, number> = {
  "openai/gpt-5.6-sol": 1_050_000,
  "openai/gpt-5.6-terra": 1_050_000,
  "openai/gpt-5.6-luna": 1_050_000,
  "openai/gpt-5.4-mini": 400_000,
  "openai/gpt-5.4-nano": 400_000,
  "google/gemini-3.1-pro-preview": 1_000_000,
  "google/gemini-3.7-flash": 1_000_000,
  "google/gemini-3-flash": 1_000_000,
  "google/gemini-3.5-flash-lite": 1_000_000,
  "google/gemini-2.5-flash-lite": 1_000_000,
  "anthropic/claude-fable-5.1": 1_000_000,
  "anthropic/claude-fable-5": 1_000_000,
  "anthropic/claude-opus-5": 1_000_000,
  "anthropic/claude-sonnet-5": 1_000_000,
  "anthropic/claude-haiku-4.5": 200_000,
  "perplexity/sonar-pro": 200_000,
  "perplexity/sonar-reasoning-pro": 127_000,
  "moonshotai/kimi-k3": 1_000_000,
  "moonshotai/kimi-k2.7-code": 256_000,
  "moonshotai/kimi-k2.6": 262_000,
  "deepseek/deepseek-v4-pro": 1_000_000,
  "deepseek/deepseek-v4-flash": 1_000_000,
  "openai/gpt-oss-120b": 131_072,
  "openai/gpt-oss-20b": 131_072,
};

export type ContextBudgetSegmentId =
  | "messages"
  | "tool_output"
  | "draft"
  | "system"
  | "tools"
  | "memory"
  | "summary"
  | "free";

export type ContextBudgetSegment = {
  id: ContextBudgetSegmentId;
  label: string;
  tokens: number;
  /** CSS color for charts (segment is omitted when tokens === 0). */
  color: string;
};

export function filterBudgetSegments(segments: ContextBudgetSegment[]): ContextBudgetSegment[] {
  return segments.filter((segment) => segment.tokens > 0);
}

export type ContextBudgetEstimate = {
  modelId: string;
  /** Concrete gateway model after Auto resolution (differs from modelId when Auto is selected). */
  resolvedModelId?: string;
  contextWindowTokens: number;
  reservedOutputTokens: number;
  inputBudgetTokens: number;
  /** Tokens estimated to be sent on the next turn (input side). */
  nextSubmitTokens: number;
  remainingInputTokens: number;
  fillRatio: number;
  contextMessageLimit: number;
  packedMessageCount: number;
  totalThreadMessages: number;
  includesRollingSummary: boolean;
  segments: ContextBudgetSegment[];
  /** Tool names armed for this turn, from compileChatTools. */
  activeToolNames?: string[];
  /** Memories merged into the system context (absent when memory search was skipped). */
  memoriesInjected?: number;
  /** `server` when built from context assembly; `default` for new-thread baseline; `client` for local compose. */
  source?: "server" | "default" | "client";
};

/**
 * Numbers-only server scaffold for client-side compose.
 * Integers + app-constant tool names only — never message/summary/memory text.
 */
export type ContextBudgetScaffold = {
  systemTokens: number;
  toolsTokens: number;
  summaryTokens: number;
  memoryTokens: number;
  memoriesInjected?: number;
  activeToolNames: string[];
  /** Absent / undefined means pack the full thread (e.g. Arcadia). */
  contextMessageLimit?: number;
  source: "server";
};

export type FinalizeContextBudgetParams = {
  modelId: string;
  resolvedModelId?: string;
  segments: ContextBudgetSegment[];
  contextMessageLimit: number;
  packedMessageCount: number;
  totalThreadMessages: number;
  includesRollingSummary: boolean;
  reservedOutputTokens?: number;
  activeToolNames?: string[];
  memoriesInjected?: number;
  source?: ContextBudgetEstimate["source"];
};

/**
 * Shared finalize: window math, fill ratio, free segment.
 * Used by client defaults, server assembly, and client compose.
 */
export function finalizeContextBudget(params: FinalizeContextBudgetParams): ContextBudgetEstimate {
  const {
    modelId,
    resolvedModelId,
    segments,
    contextMessageLimit,
    packedMessageCount,
    totalThreadMessages,
    includesRollingSummary,
    reservedOutputTokens = CHAT_RESPONSE_MAX_OUTPUT_TOKENS,
    activeToolNames,
    memoriesInjected,
    source,
  } = params;

  const windowModelId = resolvedModelId ?? modelId;
  const contextWindowTokens = getModelContextWindowTokens(windowModelId);
  const inputBudgetTokens = Math.max(0, contextWindowTokens - reservedOutputTokens);
  const usedSegments = segments.filter((segment) => segment.id !== "free");
  const nextSubmitTokens = usedSegments.reduce((sum, segment) => sum + segment.tokens, 0);
  const remainingInputTokens = Math.max(0, inputBudgetTokens - nextSubmitTokens);
  const fillRatio = inputBudgetTokens > 0 ? Math.min(1, nextSubmitTokens / inputBudgetTokens) : 0;

  return {
    modelId,
    resolvedModelId: resolvedModelId ?? modelId,
    contextWindowTokens,
    reservedOutputTokens,
    inputBudgetTokens,
    nextSubmitTokens,
    remainingInputTokens,
    fillRatio,
    contextMessageLimit,
    packedMessageCount,
    totalThreadMessages,
    includesRollingSummary,
    segments: filterBudgetSegments([
      ...usedSegments,
      {
        id: "free",
        label: "Remaining",
        tokens: remainingInputTokens,
        color: "hsl(var(--muted-foreground) / 0.18)",
      },
    ]),
    activeToolNames,
    memoriesInjected,
    source,
  };
}

/** Pull numbers-only scaffold fields from a streamed or polled budget estimate. */
export function scaffoldFromStreamBudget(budget: ContextBudgetEstimate): ContextBudgetScaffold {
  return {
    systemTokens: segmentTokens(budget, "system"),
    toolsTokens: segmentTokens(budget, "tools"),
    summaryTokens: segmentTokens(budget, "summary"),
    memoryTokens: segmentTokens(budget, "memory"),
    memoriesInjected: budget.memoriesInjected,
    activeToolNames: budget.activeToolNames ?? [],
    contextMessageLimit: budget.contextMessageLimit,
    source: "server",
  };
}

type MessageTokenMemo = { text: number; tool: number };

const messageTokenMemo = new WeakMap<UIMessage, MessageTokenMemo>();

function getMemoizedMessageTokens(message: UIMessage): MessageTokenMemo {
  const cached = messageTokenMemo.get(message);

  if (cached) return cached;

  const text = getMessageTextForTokenEstimate(message);
  const toolSerialized = getMessageToolPartsForTokenEstimate(message);
  const next: MessageTokenMemo = {
    text: text ? estimateTokenCountSync(text) : 0,
    tool: toolSerialized ? estimateTokenCountSync(toolSerialized) : 0,
  };

  messageTokenMemo.set(message, next);

  return next;
}

export type ComposeContextBudgetParams = {
  scaffold: ContextBudgetScaffold;
  threadMessages: UIMessage[];
  draftText: string;
  modelId: string;
  experience?: ChatExperience;
  zeroDataRetention?: boolean;
  reservedOutputTokens?: number;
};

/**
 * Client-side compose: scaffold numbers + local thread/draft tokenization.
 */
export function composeContextBudget(params: ComposeContextBudgetParams): ContextBudgetEstimate {
  const {
    scaffold,
    threadMessages,
    draftText,
    modelId,
    experience,
    zeroDataRetention = false,
    reservedOutputTokens = CHAT_RESPONSE_MAX_OUTPUT_TOKENS,
  } = params;

  const resolvedModelId = resolveChatModelId({
    modelId,
    draftText,
    experience,
    zeroDataRetention,
  });

  const limit = scaffold.contextMessageLimit;
  const packedMessages =
    limit == null || limit <= 0 ? threadMessages : threadMessages.slice(-limit);

  let messagesTokens = 0;
  let toolOutputTokens = 0;

  for (const message of packedMessages) {
    const counts = getMemoizedMessageTokens(message);

    messagesTokens += counts.text;
    toolOutputTokens += counts.tool;
  }

  const draftTokens = estimateTokenCountSync(draftText.trim() ? `user: ${draftText.trim()}` : "");

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
      tokens: scaffold.systemTokens,
      color: "hsl(199 89% 48% / 0.82)",
    },
    {
      id: "tools",
      label: "Tools & instructions",
      tokens: scaffold.toolsTokens,
      color: "hsl(24 95% 53% / 0.82)",
    },
    {
      id: "summary",
      label: "Rolling summary",
      tokens: scaffold.summaryTokens,
      color: "hsl(262 83% 58% / 0.78)",
    },
    {
      id: "memory",
      label: "Memory layer",
      tokens: scaffold.memoryTokens,
      color: "hsl(280 75% 55% / 0.78)",
    },
  ]);

  const resolvedLimit = limit ?? packedMessages.length;

  return finalizeContextBudget({
    modelId,
    resolvedModelId,
    segments,
    contextMessageLimit: resolvedLimit,
    packedMessageCount: packedMessages.length,
    totalThreadMessages: threadMessages.length,
    includesRollingSummary:
      scaffold.summaryTokens > 0 || (limit != null && threadMessages.length > limit),
    reservedOutputTokens,
    activeToolNames: scaffold.activeToolNames,
    memoriesInjected: scaffold.memoriesInjected,
    source: "client",
  });
}

let sharedEncoding: ReturnType<typeof encodingForModel> | null = null;

function getEncoding() {
  if (!sharedEncoding) {
    sharedEncoding = encodingForModel("gpt-5");
  }

  return sharedEncoding;
}

/** Synchronous tiktoken estimate (cl100k_base via gpt-5). */
export function estimateTokenCountSync(text: string): number {
  const trimmed = text.trim();

  if (!trimmed) return 0;

  try {
    return getEncoding().encode(trimmed).length;
  } catch {
    return Math.max(1, Math.ceil(trimmed.length / 4));
  }
}

export function getMessageTextForTokenEstimate(message: UIMessage): string {
  const parts = message.parts ?? [];
  const text = parts
    .map((part) => (part.type === "text" && "text" in part ? part.text : ""))
    .join("");

  if (text.trim()) {
    return `${message.role ?? "user"}: ${text}`;
  }

  const legacyContent =
    "content" in message && typeof message.content === "string" ? message.content : "";

  if (legacyContent.trim()) {
    return `${message.role ?? "user"}: ${legacyContent}`;
  }

  return "";
}

/** Serialized non-text parts (tool calls and results) that ship with the message. */
export function getMessageToolPartsForTokenEstimate(message: UIMessage): string {
  const parts = (message.parts ?? []).filter(
    (part) => part.type !== "text" && part.type !== "step-start"
  );

  return parts.length > 0 ? JSON.stringify(parts) : "";
}

export function segmentTokens(
  budget: ContextBudgetEstimate,
  segmentId: ContextBudgetSegmentId
): number {
  return budget.segments.find((segment) => segment.id === segmentId)?.tokens ?? 0;
}

export function getModelContextWindowTokens(modelId: string): number {
  if (modelId === AUTO_CHAT_MODEL_ID) {
    return 1_000_000;
  }

  if (modelId in MODEL_CONTEXT_WINDOW_TOKENS) {
    return MODEL_CONTEXT_WINDOW_TOKENS[modelId]!;
  }

  const provider = modelId.split("/")[0];

  if (provider === "google") return 1_000_000;
  if (provider === "anthropic") return 1_000_000;
  if (provider === "openai") return 128_000;

  return DEFAULT_CONTEXT_WINDOW_TOKENS;
}

export type ComputeContextBudgetParams = {
  modelId: string;
  threadMessages: UIMessage[];
  draftText: string;
  contextMessageLimit?: number;
  memoryEnabled?: boolean;
  webSearchEnabled?: boolean;
  messageSearchEnabled?: boolean;
  reservedOutputTokens?: number;
};

export function computeContextBudget(params: ComputeContextBudgetParams): ContextBudgetEstimate {
  const {
    modelId,
    threadMessages,
    draftText,
    contextMessageLimit = 10,
    memoryEnabled = true,
    webSearchEnabled = true,
    messageSearchEnabled = true,
    reservedOutputTokens = CHAT_RESPONSE_MAX_OUTPUT_TOKENS,
  } = params;

  const packedMessages = threadMessages.slice(-contextMessageLimit);
  const messagesTokens = packedMessages.reduce((sum, message) => {
    const text = getMessageTextForTokenEstimate(message);

    return sum + estimateTokenCountSync(text);
  }, 0);

  const toolOutputTokens = packedMessages.reduce((sum, message) => {
    const serialized = getMessageToolPartsForTokenEstimate(message);

    return sum + (serialized ? estimateTokenCountSync(serialized) : 0);
  }, 0);

  const draftTokens = estimateTokenCountSync(draftText.trim() ? `user: ${draftText.trim()}` : "");

  let systemTokens = ESTIMATED_SYSTEM_PROMPT_TOKENS;
  let toolsTokens = ESTIMATED_BASE_TOOL_TOKENS;

  if (webSearchEnabled) toolsTokens += ESTIMATED_WEB_SEARCH_TOOL_TOKENS;
  if (memoryEnabled) toolsTokens += ESTIMATED_MEMORY_TOOL_TOKENS;
  if (messageSearchEnabled) toolsTokens += ESTIMATED_MESSAGE_SEARCH_TOOL_TOKENS;

  const includesRollingSummary = threadMessages.length > contextMessageLimit;
  const summaryTokens = includesRollingSummary
    ? ESTIMATED_ROLLING_SUMMARY_BASE_TOKENS +
      Math.min(1_600, Math.max(0, threadMessages.length - contextMessageLimit) * 40)
    : 0;

  const memoryTokens = memoryEnabled ? ESTIMATED_MEMORY_CONTEXT_TOKENS : 0;

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
      tokens: systemTokens,
      color: "hsl(199 89% 48% / 0.82)",
    },
    {
      id: "tools",
      label: "Tools & instructions",
      tokens: toolsTokens,
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

  return finalizeContextBudget({
    modelId,
    segments,
    contextMessageLimit,
    packedMessageCount: packedMessages.length,
    totalThreadMessages: threadMessages.length,
    includesRollingSummary,
    reservedOutputTokens,
  });
}

export function computeNewThreadDefaultBudget(params: {
  modelId: string;
  memoryEnabled?: boolean;
  webSearchEnabled?: boolean;
  messageSearchEnabled?: boolean;
}): ContextBudgetEstimate {
  const {
    modelId,
    memoryEnabled = true,
    webSearchEnabled = true,
    messageSearchEnabled = true,
  } = params;

  let toolsTokens = ESTIMATED_BASE_TOOL_TOKENS;

  if (webSearchEnabled) toolsTokens += ESTIMATED_WEB_SEARCH_TOOL_TOKENS;
  if (memoryEnabled) toolsTokens += ESTIMATED_MEMORY_TOOL_TOKENS;
  if (messageSearchEnabled) toolsTokens += ESTIMATED_MESSAGE_SEARCH_TOOL_TOKENS;

  const segments: ContextBudgetSegment[] = [
    {
      id: "system",
      label: "System prompt",
      tokens: ESTIMATED_SYSTEM_PROMPT_TOKENS,
      color: "hsl(199 89% 48% / 0.82)",
    },
    {
      id: "tools",
      label: "Tools & instructions",
      tokens: toolsTokens,
      color: "hsl(24 95% 53% / 0.82)",
    },
  ];

  const resolvedModelId =
    modelId === AUTO_CHAT_MODEL_ID ? resolveChatModelId({ modelId }) : modelId;

  return finalizeContextBudget({
    modelId,
    resolvedModelId,
    segments,
    contextMessageLimit: 10,
    packedMessageCount: 0,
    totalThreadMessages: 0,
    includesRollingSummary: false,
    source: "default",
  });
}

export function formatTokenCount(tokens: number): string {
  if (tokens >= 1_000_000) {
    return `${(tokens / 1_000_000).toFixed(1)}M`;
  }
  if (tokens >= 10_000) {
    return `${Math.round(tokens / 1_000)}k`;
  }

  return tokens.toLocaleString();
}

/** Share of the thread's persisted messages packed into the active context window. */
export function getThreadContextCoverage(
  budget: ContextBudgetEstimate
): { ratio: number; percent: number } | null {
  if (budget.totalThreadMessages <= 0) return null;

  const ratio = Math.min(1, budget.packedMessageCount / budget.totalThreadMessages);

  return { ratio, percent: Math.round(ratio * 100) };
}

/** Rough turns remaining at the thread's current average message size. */
export function getContextHeadroomTurns(budget: ContextBudgetEstimate): number | null {
  const messageTokens = segmentTokens(budget, "messages") + segmentTokens(budget, "tool_output");

  if (budget.packedMessageCount <= 0 || messageTokens <= 0) return null;

  const perMessage = messageTokens / budget.packedMessageCount;

  return Math.floor(budget.remainingInputTokens / perMessage);
}

/** How much of the packed input is the conversation versus app scaffolding. */
export function getContextComposition(
  budget: ContextBudgetEstimate
): { conversationPercent: number; scaffoldingPercent: number } | null {
  if (budget.nextSubmitTokens <= 0) return null;

  const conversation =
    segmentTokens(budget, "messages") +
    segmentTokens(budget, "tool_output") +
    segmentTokens(budget, "draft");
  const conversationPercent = Math.round((conversation / budget.nextSubmitTokens) * 100);

  return {
    conversationPercent,
    scaffoldingPercent: Math.max(0, 100 - conversationPercent),
  };
}
