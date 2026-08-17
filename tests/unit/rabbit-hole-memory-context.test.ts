import { describe, expect, test } from "bun:test";

import {
  resolveMemoryEnabledForExperience,
  shouldSkipMemoryWriteForExperience,
} from "@/lib/chat/chat-experience";
import { RABBIT_HOLE_MEMORY_CONTEXT_WARN_MS } from "@/lib/rabbit-holes/memory-context-models";
import { warnIfRabbitHoleMemoryContextSlow } from "@/lib/rabbit-holes/memory-context-builder";

describe("rabbit hole memory policy", () => {
  test("enables memory read by default for rabbit_hole", () => {
    expect(resolveMemoryEnabledForExperience("rabbit_hole", undefined)).toBe(true);
  });

  test("skips memory writes for rabbit_hole", () => {
    expect(shouldSkipMemoryWriteForExperience("rabbit_hole")).toBe(true);
    expect(shouldSkipMemoryWriteForExperience("arcadia")).toBe(false);
  });
});

describe("warnIfRabbitHoleMemoryContextSlow", () => {
  test("does not warn at or below threshold", () => {
    const warnSpy = console.warn;

    console.warn = () => undefined;

    expect(() =>
      warnIfRabbitHoleMemoryContextSlow({
        memorySearchMs: 120,
        llmSynthesisMs: 100,
        totalMs: RABBIT_HOLE_MEMORY_CONTEXT_WARN_MS,
      })
    ).not.toThrow();

    console.warn = warnSpy;
  });

  test("warns above threshold with breakdown", () => {
    const messages: string[] = [];
    const warnSpy = console.warn;

    console.warn = (msg: string) => {
      messages.push(msg);
    };

    warnIfRabbitHoleMemoryContextSlow(
      {
        memorySearchMs: 180,
        llmSynthesisMs: 120,
        totalMs: 320,
      },
      { sessionId: "sess-1", nodeId: "node-1" }
    );

    console.warn = warnSpy;

    expect(messages.some((m) => m.includes("exceeded"))).toBe(true);
    const warnLine = messages.find((m) => m.includes("exceeded")) ?? "";
    expect(warnLine).toContain(String(RABBIT_HOLE_MEMORY_CONTEXT_WARN_MS));
    expect(warnLine).toContain("memorySearch=180.0ms");
    expect(warnLine).toContain("llmSynthesis=120.0ms");
    expect(warnLine).toContain("total=320.0ms");
    expect(warnLine).toContain("sess-1");
  });
});
