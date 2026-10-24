/**
 * Static trace payload for the public `/showcase/anatomy` scrollytelling demo.
 * Shapes are documentation-only for hand-authored JSON; runtime import is typed in demo-trace.ts.
 */

import type { ExaSearchResultSource } from "@/lib/exa/types";
import type { ChatAIActionEnum } from "@/types/ai";

export type ShowcaseStageBase = {
  id: string;
  title: string;
  annotation: string;
  timingMs?: number;
};

export type InputIntentArtifact = {
  rawMessage: string;
  /** Must match an id from `ChatModels` in lib/schemas/chat.ts for the model rail UI. */
  selectedModelId: string;
  availableTools: string[];
};

export type ContextPackStep =
  | { kind: "load_thread"; label: string; detail?: string }
  | { kind: "attach_summary"; tokenCount: number; label?: string }
  | {
      kind: "attach_memories";
      items: Array<{ label: string; tokens: number }>;
    }
  | { kind: "trim"; label: string; reason: string; estimatedTokens: number };

export type ContextLoadArtifact = {
  threadId: string;
  messagesLoaded: number;
  rollingSummaryTokens: number;
  lastNTurns: number;
  /** Same text as the user turn being packed (may mirror trace.prompt). */
  incomingMessage: string;
  /** Ordered pipeline narrative for the context stage UI. */
  contextPackSteps: ContextPackStep[];
  excluded: Array<{ label: string; reason: string; estimatedTokens: number }>;
  budget: {
    contextWindowTokens: number;
    reservedForCompletion: number;
    usedByContextPack: number;
  };
};

export type MemorySearchArtifact = {
  query: string;
  topK: number;
  injected: Array<{ memory: string; score?: number }>;
  filteredOut: Array<{ memory: string; reason: string; score?: number }>;
};

export type ToolRoutingCall = {
  toolName: string;
  toolCallId: string;
  arguments: unknown;
  /** Exa / Mem0 / server tools vs rare client-only UI tools. */
  execution: "server" | "client";
  latencyMs?: number;
};

export type ToolRoutingArtifact = {
  modelNotes: string;
  toolCalls: ToolRoutingCall[];
};

export type ShowcaseAiActionTimelineEntry = {
  action: ChatAIActionEnum;
  message?: string;
  sources?: ExaSearchResultSource[];
};

export type TokenBudgetArtifact = {
  promptTokens: number;
  maxOutputTokens: number;
  streamBufferTargetChars: number;
  gracefulFinishInstruction: string;
  /** Frozen sequence shown as production `ChatAIAction` rows. */
  aiActionTimeline: ShowcaseAiActionTimelineEntry[];
};

export type RenderStageArtifact = {
  rawMarkdown: string;
  /** Same payloads the conversation rail passes to ArcadiaToolResultCard */
  toolCards: ReadonlyArray<{ toolName: string; displayBody: unknown }>;
};

export type TtsStageArtifact = {
  speechFriendlyBefore: string;
  speechFriendlyAfter: string;
  /** Public URL under /public/showcase */
  audioUrl: string;
};

export type InputIntentStage = ShowcaseStageBase & {
  id: "input";
  artifact: InputIntentArtifact;
};

export type ContextLoadStage = ShowcaseStageBase & {
  id: "context";
  artifact: ContextLoadArtifact;
};

export type MemorySearchStage = ShowcaseStageBase & {
  id: "memory";
  artifact: MemorySearchArtifact;
};

export type ToolRoutingStage = ShowcaseStageBase & {
  id: "tools";
  artifact: ToolRoutingArtifact;
};

export type TokenBudgetStage = ShowcaseStageBase & {
  id: "budget";
  artifact: TokenBudgetArtifact;
};

export type RenderStage = ShowcaseStageBase & {
  id: "render";
  artifact: RenderStageArtifact;
};

export type TtsStage = ShowcaseStageBase & {
  id: "tts";
  artifact: TtsStageArtifact;
};

export type ShowcaseStagesTuple = readonly [
  InputIntentStage,
  ContextLoadStage,
  MemorySearchStage,
  ToolRoutingStage,
  TokenBudgetStage,
  RenderStage,
  TtsStage,
];

export type ShowcaseFinalResponse = {
  markdown: string;
  toolCards: ReadonlyArray<{ toolName: string; displayBody: unknown }>;
};

export type ShowcaseTrace = {
  capturedAt: string;
  prompt: string;
  stages: ShowcaseStagesTuple;
  finalResponse: ShowcaseFinalResponse;
};

export type ShowcaseStage = ShowcaseStagesTuple[number];
