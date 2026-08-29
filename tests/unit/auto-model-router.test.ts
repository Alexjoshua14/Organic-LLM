import { describe, expect, test } from "bun:test";

import {
  REASONING_IDS_ANY,
  REASONING_IDS_ZDR,
  REFLEX_IDS_ZDR,
  chatModelForGatewayId,
  classifyTaskTier,
  tierToGatewayModelId,
} from "@/lib/llm/auto-model-router";
import { AUTO_CHAT_MODEL_ID, ChatModels } from "@/lib/schemas/chat";

describe("classifyTaskTier", () => {
  test("short plain text is reflex", () => {
    expect(classifyTaskTier("remember I like oat milk")).toBe("reflex");
  });

  test("keyword why routes to reasoning", () => {
    expect(classifyTaskTier("Why is the sky blue?")).toBe("reasoning");
  });

  test("long text routes to reasoning", () => {
    const s = "x".repeat(300);
    expect(classifyTaskTier(s)).toBe("reasoning");
  });
});

describe("chatModelForGatewayId", () => {
  test("returns catalog row for known id", () => {
    const m = chatModelForGatewayId("openai/gpt-5.4-nano");
    expect(m.id).toBe("openai/gpt-5.4-nano");
  });
});

describe("tierToGatewayModelId", () => {
  test("preference lists only contain catalog ids", () => {
    const catalog = new Set(ChatModels.map((c) => c.id));

    for (const id of [...REFLEX_IDS_ZDR, ...REASONING_IDS_ZDR, ...REASONING_IDS_ANY]) {
      expect(catalog.has(id)).toBe(true);
    }
  });

  test("ZDR reflex prefers Gemini 3.5 Flash Lite", () => {
    expect(tierToGatewayModelId("reflex", true)).toBe("google/gemini-3.5-flash-lite");
  });

  test("ZDR reflex picks a ZDR-capable model", () => {
    const id = tierToGatewayModelId("reflex", true);
    const row = ChatModels.find((c) => c.id === id)!;
    expect(row.id).not.toBe(AUTO_CHAT_MODEL_ID);
    expect(row.supportsZeroDataRetention).not.toBe(false);
  });

  test("ZDR reasoning picks a ZDR-capable model", () => {
    const id = tierToGatewayModelId("reasoning", true);
    const row = ChatModels.find((c) => c.id === id)!;
    expect(row.id).not.toBe(AUTO_CHAT_MODEL_ID);
    expect(row.supportsZeroDataRetention).not.toBe(false);
  });

  test("non-ZDR reasoning may use non-ZDR catalog entries", () => {
    const id = tierToGatewayModelId("reasoning", false);
    expect(ChatModels.some((c) => c.id === id)).toBe(true);
  });
});
