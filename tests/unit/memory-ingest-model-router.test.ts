import { describe, expect, test } from "bun:test";

import {
  chatModelForGatewayId,
  classifyIngestTier,
  tierToGatewayModelId,
} from "@/app/sandbox/prototypes/memory-ingest/_lib/ingest-model-router";
import { ChatModels } from "@/lib/schemas/chat";

describe("classifyIngestTier", () => {
  test("short plain text is reflex", () => {
    expect(classifyIngestTier("remember I like oat milk")).toBe("reflex");
  });

  test("keyword why routes to reasoning", () => {
    expect(classifyIngestTier("Why is the sky blue?")).toBe("reasoning");
  });

  test("long text routes to reasoning", () => {
    const s = "x".repeat(300);
    expect(classifyIngestTier(s)).toBe("reasoning");
  });
});

describe("chatModelForGatewayId", () => {
  test("returns catalog row for known id", () => {
    const m = chatModelForGatewayId("openai/gpt-5.4-nano");
    expect(m.id).toBe("openai/gpt-5.4-nano");
  });
});

describe("tierToGatewayModelId", () => {
  test("ZDR reflex picks a ZDR-capable model", () => {
    const id = tierToGatewayModelId("reflex", true);
    const row = ChatModels.find((c) => c.id === id);
    expect(row).toBeDefined();
    expect(row?.supportsZeroDataRetention).not.toBe(false);
  });

  test("ZDR reasoning picks a ZDR-capable model", () => {
    const id = tierToGatewayModelId("reasoning", true);
    const row = ChatModels.find((c) => c.id === id);
    expect(row?.supportsZeroDataRetention).not.toBe(false);
  });

  test("non-ZDR reasoning may use non-ZDR catalog entries", () => {
    const id = tierToGatewayModelId("reasoning", false);
    expect(ChatModels.some((c) => c.id === id)).toBe(true);
  });
});
