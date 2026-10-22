import type { UIMessage } from "ai";

import { getToolOrDynamicToolName, isToolUIPart } from "ai";

type MessageParts = UIMessage["parts"];

/**
 * Tools whose work is behind-the-scenes process: inspectable in the activity trail, not
 * presented to the user. Anything else (gen-UI, boards, plans, diagrams, task writes,
 * orchestration, unknown tools) stays inline and splits the trail.
 */
const PROCESS_TOOL_NAMES = new Set([
  "web_search",
  "search_memories",
  "memory_search",
  "list_recent_memories",
  "get_more_chat_history",
  "get_full_chat_history",
  "get_messages_from_date",
  "read_subagent_thread",
  "gather_restaurant",
  "fetch_recipe",
  "search_knowledge_nodes",
  "traverse_knowledge_graph",
  "research_capabilities",
  "research_search",
  "research_read",
  "research_scrape",
  "research_map",
  "research_crawl",
  "research_parse_document",
  "research_source",
  "research_annotations",
  "research_audit",
]);

export function isProcessToolName(toolName: string): boolean {
  return PROCESS_TOOL_NAMES.has(toolName.toLowerCase());
}

/** How a part relates to the activity trail. Server timing and client grouping share these rules. */
export type TrailRole = "member" | "breaker" | "neutral";

/** Message metadata written by the chat stream; durations keyed by trail ordinal. */
export type ActivityTrailMetadata = {
  activityDurationsMs?: Record<string, number>;
};

type LegacyToolInvocationPart = { type: "tool-invocation"; toolName: string; state: string };

function legacyToolPart(part: MessageParts[number]): LegacyToolInvocationPart | null {
  const p = part as unknown as Partial<LegacyToolInvocationPart>;

  return p.type === "tool-invocation" && typeof p.toolName === "string"
    ? (p as LegacyToolInvocationPart)
    : null;
}

export function classifyMessagePart(part: MessageParts[number]): TrailRole {
  if (part.type === "reasoning") return "member";
  if (part.type === "text") return part.text.trim() ? "breaker" : "neutral";
  if (isToolUIPart(part)) {
    return isProcessToolName(getToolOrDynamicToolName(part)) ? "member" : "breaker";
  }

  const legacy = legacyToolPart(part);

  if (legacy) return isProcessToolName(legacy.toolName) ? "member" : "breaker";

  return "neutral";
}

/** Same rules over `streamText` parts, in the order the UI message is built from them. */
function classifyStreamPart(part: { type: string; text?: string; toolName?: string }): TrailRole {
  switch (part.type) {
    case "reasoning-start":
      return "member";
    case "text-delta":
      return part.text?.trim() ? "breaker" : "neutral";
    case "tool-input-start":
    case "tool-call":
      return part.toolName && isProcessToolName(part.toolName) ? "member" : "breaker";
    default:
      return "neutral";
  }
}

/**
 * Measures each trail on the server for `toUIMessageStream({ messageMetadata })`.
 * A trail runs from the start of the model step that opened it (so first-token wait counts)
 * until the first breaker or the end of the stream. Returns metadata only when a trail closes.
 */
export function createActivityTrailTimer(now: () => number = Date.now) {
  let ordinal = 0;
  let openedAt: number | null = null;
  let stepStartedAt: number | null = null;

  const close = (): ActivityTrailMetadata | undefined => {
    if (openedAt === null) return undefined;
    const durationMs = Math.max(0, now() - openedAt);
    const metadata = { activityDurationsMs: { [String(ordinal)]: durationMs } };

    ordinal += 1;
    openedAt = null;

    return metadata;
  };

  return (part: { type: string; text?: string; toolName?: string }) => {
    if (part.type === "finish" || part.type === "abort" || part.type === "error") return close();
    if (part.type === "start-step") {
      if (openedAt === null) stepStartedAt = now();

      return undefined;
    }

    const role = classifyStreamPart(part);

    if (role === "member" && openedAt === null) {
      openedAt = stepStartedAt ?? now();
      stepStartedAt = null;
    } else if (role === "breaker") {
      stepStartedAt = null;

      return close();
    }

    return undefined;
  };
}

export type ActivityStep =
  | { kind: "reasoning"; text: string; isStreaming: boolean; partIndex: number }
  | { kind: "tool"; partIndex: number; toolName: string; isInFlight: boolean };

export type ActivityTrail = {
  /** Position among this message's trails; keys the server-measured duration. */
  ordinal: number;
  startIndex: number;
  /** Indices of member parts (reasoning and process tools), in order. */
  memberIndices: number[];
  /** Consecutive reasoning parts merged; tools kept in place. */
  steps: ActivityStep[];
  hasReasoning: boolean;
  /** A reasoning part or process tool is still streaming. */
  hasStreamingMember: boolean;
};

export type ActivityTrails = {
  trailsByStartIndex: Map<number, ActivityTrail>;
  /** Member indices after each trail's start; they render inside the trail instead. */
  foldedIndices: Set<number>;
  /** True when no breaker follows the last trail, so it may still be growing. */
  lastSegmentIsTrail: boolean;
};

/** Groups reasoning and process tools into trails; text and product tools split them. */
export function groupActivityTrails(parts: MessageParts): ActivityTrails {
  const trailsByStartIndex = new Map<number, ActivityTrail>();
  const foldedIndices = new Set<number>();
  let current: ActivityTrail | null = null;
  let ordinal = 0;

  parts.forEach((part, i) => {
    const role = classifyMessagePart(part);

    if (role === "breaker") {
      current = null;

      return;
    }
    if (role === "neutral") return;

    if (!current) {
      current = {
        ordinal: ordinal++,
        startIndex: i,
        memberIndices: [],
        steps: [],
        hasReasoning: false,
        hasStreamingMember: false,
      };
      trailsByStartIndex.set(i, current);
    } else {
      foldedIndices.add(i);
    }
    current.memberIndices.push(i);

    if (part.type === "reasoning") {
      const text = part.text.trim();
      const isStreaming = part.state === "streaming";
      const last = current.steps[current.steps.length - 1];

      current.hasReasoning = true;
      if (isStreaming) current.hasStreamingMember = true;
      if (last?.kind === "reasoning") {
        if (text) last.text = last.text ? `${last.text}\n\n${text}` : text;
        last.isStreaming ||= isStreaming;
      } else {
        current.steps.push({ kind: "reasoning", text, isStreaming, partIndex: i });
      }

      return;
    }

    const legacy = legacyToolPart(part);
    const toolName = legacy ? legacy.toolName : getToolOrDynamicToolName(part as never);
    const state = legacy ? legacy.state : (part as { state: string }).state;
    const isInFlight = ["input-streaming", "input-available", "partial-call", "call"].includes(
      state
    );

    if (isInFlight) current.hasStreamingMember = true;
    current.steps.push({ kind: "tool", partIndex: i, toolName, isInFlight });
  });

  return {
    trailsByStartIndex,
    foldedIndices,
    lastSegmentIsTrail: current !== null,
  };
}

export function readTrailDuration(message: UIMessage, ordinal: number): number | null {
  const durations = (message.metadata as ActivityTrailMetadata | undefined)?.activityDurationsMs;
  const value = durations?.[String(ordinal)];

  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function formatThoughtDuration(ms: number): string {
  const seconds = Math.max(1, Math.round(ms / 1000));

  if (seconds < 60) return `Thought for ${seconds}s`;

  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;

  return rest === 0 ? `Thought for ${minutes}m` : `Thought for ${minutes}m ${rest}s`;
}

/**
 * Live headline from a reasoning summary: its latest bold or Markdown heading, otherwise its
 * latest complete sentence. The sentence still being written is ignored, so the label holds
 * steady until the next one finishes.
 */
export function reasoningHeadline(text: string): string | null {
  const heading = [...text.matchAll(/^(?:\*\*(.+?)\*\*|#{1,6}\s+(.+))\s*$/gm)].at(-1);
  const sentence = [...text.matchAll(/[^.!?\n]+[.!?]+["')\]]?(?=\s|$)/g)].at(-1)?.[0];
  const candidate = (heading?.[1] ?? heading?.[2] ?? sentence)?.replace(/[*_`#]/g, "").trim();

  return candidate || null;
}
