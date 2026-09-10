import { describe, expect, test } from "bun:test";

import {
  REASONING_IDS_ANY,
  REASONING_IDS_ZDR,
  REFLEX_IDS_ZDR,
  chatModelForGatewayId,
  classifyTaskTier,
  tierToGatewayModelId,
} from "@/lib/llm/auto-model-router";
import {
  AUTO_CHAT_MODEL_ID,
  ChatModelCatalog,
  DEFAULT_CHAT_MODEL,
  models,
  type GatewayModelId,
} from "@/lib/schemas/chat";

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
  test("returns catalog row for a models alias id", () => {
    const m = chatModelForGatewayId(models.openai.luna.id as GatewayModelId);
    expect(m.id).toBe(models.openai.luna.id);
  });

  test("unknown ids fall back to DEFAULT_CHAT_MODEL", () => {
    const m = chatModelForGatewayId("openai/gpt-5.4-nano" as GatewayModelId);
    expect(m).toEqual(DEFAULT_CHAT_MODEL);
  });
});

describe("tierToGatewayModelId", () => {
  test("preference lists only contain catalog ids", () => {
    const catalog = new Set(ChatModelCatalog.map((c) => c.id));

    for (const id of [...REFLEX_IDS_ZDR, ...REASONING_IDS_ZDR, ...REASONING_IDS_ANY]) {
      expect(catalog.has(id)).toBe(true);
    }
  });

  test("ZDR reflex prefers Gemini Flash Lite via models", () => {
    expect(tierToGatewayModelId("reflex", true)).toBe(models.google.flashLite.id);
  });

  test("ZDR reflex picks a ZDR-capable model", () => {
    const id = tierToGatewayModelId("reflex", true);
    const row = ChatModelCatalog.find((c) => c.id === id)!;
    expect(row.id).not.toBe(AUTO_CHAT_MODEL_ID);
    expect(row.supportsZeroDataRetention).not.toBe(false);
  });

  test("ZDR reasoning picks a ZDR-capable model", () => {
    const id = tierToGatewayModelId("reasoning", true);
    const row = ChatModelCatalog.find((c) => c.id === id)!;
    expect(row.id).not.toBe(AUTO_CHAT_MODEL_ID);
    expect(row.supportsZeroDataRetention).not.toBe(false);
  });

  test("non-ZDR reasoning may use non-ZDR catalog entries", () => {
    const id = tierToGatewayModelId("reasoning", false);
    expect(ChatModelCatalog.some((c) => c.id === id)).toBe(true);
  });
});
