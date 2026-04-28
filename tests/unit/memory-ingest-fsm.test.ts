import { describe, expect, test } from "bun:test";

import {
  initialMemoryIngestFsmState,
  mapChatStatusToIngestEvent,
  mapDataAiActionToIngestEvent,
  memoryIngestReducer,
} from "@/app/sandbox/prototypes/memory-ingest/_lib/memory-ingest-fsm";
import { ChatAIActionEnum } from "@/types/ai";

describe("memoryIngestReducer", () => {
  test("draft with text enters listening", () => {
    const s = memoryIngestReducer(initialMemoryIngestFsmState, { type: "DRAFT", hasText: true });
    expect(s.visual).toBe("listening");
  });

  test("submit enters ingesting and stores tier", () => {
    let s = memoryIngestReducer(initialMemoryIngestFsmState, { type: "SUBMIT", tier: "reasoning" });
    expect(s.visual).toBe("ingesting");
    expect(s.lastTier).toBe("reasoning");
    s = memoryIngestReducer(s, {
      type: "AI_ACTION",
      action: ChatAIActionEnum.Tool,
      message: "Using tool: search_memories",
    });
    expect(s.visual).toBe("searching_memory");
  });

  test("tool web_search maps to web_search", () => {
    const s0 = memoryIngestReducer(
      { ...initialMemoryIngestFsmState, visual: "ingesting", lastTier: "reflex" },
      {
        type: "AI_ACTION",
        action: ChatAIActionEnum.Tool,
        message: "Using tool: web_search",
      }
    );
    expect(s0.visual).toBe("web_search");
  });

  test("legacy memory_search tool name maps to searching_memory", () => {
    const s0 = memoryIngestReducer(
      { ...initialMemoryIngestFsmState, visual: "ingesting", lastTier: "reflex" },
      {
        type: "AI_ACTION",
        action: ChatAIActionEnum.Tool,
        message: "Using tool: memory_search",
      }
    );
    expect(s0.visual).toBe("searching_memory");
  });

  test("finish with memory shows writing_memory then receipt clears", () => {
    let s = memoryIngestReducer(
      { ...initialMemoryIngestFsmState, visual: "reasoning" },
      { type: "FINISH", memoryEnabled: true }
    );
    expect(s.visual).toBe("writing_memory");
    s = memoryIngestReducer(s, { type: "RECEIPT_DONE" });
    expect(s.visual).toBe("idle_ready");
  });

  test("finish without memory skips writing_memory", () => {
    const s = memoryIngestReducer(
      { ...initialMemoryIngestFsmState, visual: "reasoning" },
      { type: "FINISH", memoryEnabled: false }
    );
    expect(s.visual).toBe("idle_ready");
  });

  test("debug set overrides visual", () => {
    const s = memoryIngestReducer(initialMemoryIngestFsmState, {
      type: "DEBUG_SET",
      visual: "web_search",
      intensity: 0.8,
    });
    expect(s.visual).toBe("web_search");
    expect(s.intensity).toBe(0.8);
  });
});

describe("mapChatStatusToIngestEvent", () => {
  test("maps submitted and streaming", () => {
    expect(mapChatStatusToIngestEvent("submitted")?.type).toBe("STATUS_SUBMITTED");
    expect(mapChatStatusToIngestEvent("streaming")?.type).toBe("STATUS_STREAMING");
    expect(mapChatStatusToIngestEvent("ready")).toBeNull();
  });
});

describe("mapDataAiActionToIngestEvent", () => {
  test("parses data-aiAction envelope", () => {
    const ev = mapDataAiActionToIngestEvent({
      type: "data-aiAction",
      data: { action: ChatAIActionEnum.Memory, query: "prefs" },
    });
    expect(ev).toEqual({
      type: "AI_ACTION",
      action: ChatAIActionEnum.Memory,
      message: undefined,
      query: "prefs",
    });
  });

  test("returns null for unrelated payloads", () => {
    expect(mapDataAiActionToIngestEvent({ type: "other" })).toBeNull();
  });
});
