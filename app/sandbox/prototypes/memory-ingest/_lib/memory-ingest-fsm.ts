import type { ChatStatus } from "ai";
import type { IngestModelTier, MemoryIngestFsmState, ParticleFieldVisualState } from "./types";

import { INGEST_INTENSITY } from "./memory-ingest-tuning";

import { ChatAIActionEnum } from "@/types/ai";

export type MemoryIngestFsmEvent =
  | { type: "DRAFT"; hasText: boolean }
  | { type: "SUBMIT"; tier: IngestModelTier }
  | { type: "STATUS_SUBMITTED" }
  | { type: "STATUS_STREAMING" }
  | { type: "ERROR" }
  | {
      type: "AI_ACTION";
      action: ChatAIActionEnum;
      message?: string;
      query?: string;
    }
  | { type: "FINISH" }
  | { type: "RECEIPT_DONE" }
  | { type: "COMMIT_FAILED" }
  | { type: "DEBUG_SET"; visual: ParticleFieldVisualState; intensity?: number };

export const initialMemoryIngestFsmState: MemoryIngestFsmState = {
  visual: "idle_ready",
  intensity: INGEST_INTENSITY.idle_ready,
  lastTier: "reflex",
};

function toolNameFromAiActionMessage(message?: string): string | undefined {
  if (!message?.includes(": ")) return undefined;

  return message.split(": ").slice(1).join(": ").trim();
}

/**
 * Maps transient `data-aiAction` stream parts (same family as main chat) to FSM events.
 */
export function mapDataAiActionToIngestEvent(data: unknown): MemoryIngestFsmEvent | null {
  if (!data || typeof data !== "object") return null;
  const d = data as { type?: string; data?: unknown };

  if (d.type !== "data-aiAction" || !d.data || typeof d.data !== "object") return null;
  const payload = d.data as {
    action?: ChatAIActionEnum;
    message?: string;
    query?: string;
  };

  if (!payload.action) return null;

  return {
    type: "AI_ACTION",
    action: payload.action,
    message: payload.message,
    query: payload.query,
  };
}

export function mapChatStatusToIngestEvent(status: ChatStatus): MemoryIngestFsmEvent | null {
  if (status === "submitted") return { type: "STATUS_SUBMITTED" };
  if (status === "streaming") return { type: "STATUS_STREAMING" };
  if (status === "error") return { type: "ERROR" };

  return null;
}

function aiActionToVisual(
  ev: Extract<MemoryIngestFsmEvent, { type: "AI_ACTION" }>,
  lastTier: IngestModelTier
): ParticleFieldVisualState {
  switch (ev.action) {
    case ChatAIActionEnum.Reasoning:
      return "reasoning";
    case ChatAIActionEnum.Search:
      return "web_search";
    case ChatAIActionEnum.Memory:
      return "searching_memory";
    case ChatAIActionEnum.Tool: {
      const tool = toolNameFromAiActionMessage(ev.message);

      if (tool === "web_search") return "web_search";
      if (tool === "memory_search" || tool === "search_memories") return "searching_memory";
      // An actual write to the corpus — the chamber's signature beat. Only commit_memory
      // qualifies; propose_memory is a draft echo (no write) and stays on the default path.
      if (tool === "commit_memory") return "writing_memory";

      return lastTier === "reasoning" ? "reasoning" : "ingesting";
    }
    default:
      return lastTier === "reasoning" ? "reasoning" : "ingesting";
  }
}

export function memoryIngestReducer(
  state: MemoryIngestFsmState,
  event: MemoryIngestFsmEvent
): MemoryIngestFsmState {
  switch (event.type) {
    case "DEBUG_SET":
      return {
        ...state,
        visual: event.visual,
        intensity: event.intensity ?? state.intensity,
      };
    case "DRAFT": {
      if (state.visual === "writing_memory") return state;
      const visual = event.hasText ? "listening" : "idle_ready";

      return { ...state, visual, intensity: INGEST_INTENSITY[visual] };
    }
    case "SUBMIT":
      return {
        ...state,
        visual: "ingesting",
        intensity: INGEST_INTENSITY.ingesting,
        lastTier: event.tier,
      };
    case "STATUS_SUBMITTED":
      if (state.visual === "writing_memory") return state;

      return { ...state, visual: "ingesting", intensity: INGEST_INTENSITY.ingesting };
    case "STATUS_STREAMING":
      if (state.visual === "writing_memory") return state;
      if (state.visual === "idle_ready" || state.visual === "listening") {
        return { ...state, visual: "ingesting", intensity: INGEST_INTENSITY.ingesting };
      }

      return state;
    case "AI_ACTION": {
      if (state.visual === "writing_memory") return state;
      const visual = aiActionToVisual(event, state.lastTier);

      return { ...state, visual, intensity: INGEST_INTENSITY[visual] };
    }
    case "FINISH":
      // The writing_memory beat is earned by a real commit_memory tool-call mid-stream
      // (held by the stickiness guards), not fabricated from the memory toggle. If a write
      // happened, let the beat linger to RECEIPT_DONE; otherwise settle straight to idle.
      if (state.visual === "writing_memory") {
        return { ...state, intensity: INGEST_INTENSITY.writing_memory };
      }

      return { ...state, visual: "idle_ready", intensity: INGEST_INTENSITY.idle_ready };
    case "RECEIPT_DONE":
      return { ...state, visual: "idle_ready", intensity: INGEST_INTENSITY.idle_ready };
    case "COMMIT_FAILED":
      return { ...state, visual: "idle_ready", intensity: INGEST_INTENSITY.idle_ready };
    case "ERROR":
      return { ...state, visual: "idle_ready", intensity: INGEST_INTENSITY.idle_ready };
    default:
      return state;
  }
}
