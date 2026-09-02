import { describe, expect, test } from "bun:test";

import type { UIMessage } from "ai";
import { encodingForModel } from "js-tiktoken";

import { resolveChatModelId } from "@/lib/api/resolve-chat-model";
import {
  composeContextBudget,
  computeContextBudget,
  computeNewThreadDefaultBudget,
  estimateTokenCountSync,
  ESTIMATED_SYSTEM_PROMPT_TOKENS,
  finalizeContextBudget,
  getContextComposition,
  getContextHeadroomTurns,
  getMessageToolPartsForTokenEstimate,
  getModelContextWindowTokens,
  getThreadContextCoverage,
  scaffoldFromStreamBudget,
  type ContextBudgetScaffold,
} from "@/lib/chat/context-budget";
import { AUTO_CHAT_MODEL_ID, AUTO_RESOLVED_SONNET_MODEL_ID } from "@/lib/schemas/chat";

function userMessage(text: string, id = "u1"): UIMessage {
  return {
    id,
    role: "user",
    parts: [{ type: "text", text }],
  };
}

function assistantWithToolOutput(): UIMessage {
  return {
    id: "a1",
    role: "assistant",
    parts: [
      { type: "text", text: "Here are the results." },
      {
        type: "tool-invocation",
        toolCallId: "call-1",
        toolName: "web_search",
        state: "output-available",
        input: { query: "weather" },
        output: { summary: "Sunny and warm in San Francisco today." },
      },
    ],
  };
}

function fixtureScaffold(overrides: Partial<ContextBudgetScaffold> = {}): ContextBudgetScaffold {
  return {
    systemTokens: 3_400,
    toolsTokens: 1_100,
    summaryTokens: 0,
    memoryTokens: 0,
    activeToolNames: ["manage_tasks"],
    contextMessageLimit: 10,
    source: "server",
    ...overrides,
  };
}

describe("computeContextBudget", () => {
  test("counts draft text toward next submit total", () => {
    const budget = computeContextBudget({
      modelId: "openai/gpt-5.6-terra",
      threadMessages: [userMessage("Hello there")],
      draftText: "What is next?",
      memoryEnabled: false,
      webSearchEnabled: false,
      messageSearchEnabled: false,
    });

    expect(budget.nextSubmitTokens).toBeGreaterThan(estimateTokenCountSync("Hello there"));
    expect(budget.segments.find((s) => s.id === "draft")?.tokens).toBeGreaterThan(0);
  });

  test("adds rolling summary when thread exceeds last-N window", () => {
    const thread = Array.from({ length: 12 }, (_, i) => userMessage(`Turn ${i + 1}`, `u${i}`));
    const budget = computeContextBudget({
      modelId: "anthropic/claude-sonnet-5",
      threadMessages: thread,
      draftText: "",
      contextMessageLimit: 10,
      memoryEnabled: false,
      webSearchEnabled: false,
      messageSearchEnabled: false,
    });

    expect(budget.includesRollingSummary).toBe(true);
    expect(budget.packedMessageCount).toBe(10);
    expect(budget.segments.find((s) => s.id === "summary")?.tokens).toBeGreaterThan(0);
  });

  test("counts tool output parts in a dedicated segment", () => {
    const budget = computeContextBudget({
      modelId: "openai/gpt-5.6-terra",
      threadMessages: [assistantWithToolOutput()],
      draftText: "",
      memoryEnabled: false,
      webSearchEnabled: false,
      messageSearchEnabled: false,
    });

    expect(getMessageToolPartsForTokenEstimate(assistantWithToolOutput())).not.toBe("");
    expect(budget.segments.find((segment) => segment.id === "tool_output")?.tokens).toBeGreaterThan(
      0
    );
  });

  test("reserves output tokens from the model window", () => {
    const window = getModelContextWindowTokens("openai/gpt-5.6-terra");
    const budget = computeContextBudget({
      modelId: "openai/gpt-5.6-terra",
      threadMessages: [],
      draftText: "",
      memoryEnabled: false,
      webSearchEnabled: false,
      messageSearchEnabled: false,
    });

    expect(budget.inputBudgetTokens).toBeLessThan(window);
    expect(budget.reservedOutputTokens).toBeGreaterThan(0);
  });
});

describe("computeNewThreadDefaultBudget", () => {
  test("defaults to system prompt and tool overhead only", () => {
    const budget = computeNewThreadDefaultBudget({
      modelId: "openai/gpt-5.6-terra",
      memoryEnabled: false,
      webSearchEnabled: false,
      messageSearchEnabled: false,
    });

    expect(budget.source).toBe("default");
    expect(budget.packedMessageCount).toBe(0);
    expect(budget.totalThreadMessages).toBe(0);
    expect(budget.segments.find((s) => s.id === "system")?.tokens).toBe(
      ESTIMATED_SYSTEM_PROMPT_TOKENS
    );
    expect(budget.segments.find((s) => s.id === "messages")).toBeUndefined();
  });

  test("resolves Auto to Sonnet for window sizing", () => {
    const budget = computeNewThreadDefaultBudget({
      modelId: AUTO_CHAT_MODEL_ID,
      memoryEnabled: false,
      webSearchEnabled: false,
      messageSearchEnabled: false,
    });

    expect(budget.resolvedModelId).toBe(AUTO_RESOLVED_SONNET_MODEL_ID);
    expect(budget.contextWindowTokens).toBe(
      getModelContextWindowTokens(AUTO_RESOLVED_SONNET_MODEL_ID)
    );
  });
});

describe("composeContextBudget", () => {
  test("matches finalize math for the same scaffold + message tokens", () => {
    const thread = [userMessage("Hello there"), assistantWithToolOutput()];
    const draftText = "What is next?";
    const scaffold = fixtureScaffold({
      systemTokens: 3_512,
      toolsTokens: 1_240,
      summaryTokens: 80,
      memoryTokens: 900,
      memoriesInjected: 0,
      activeToolNames: ["manage_tasks", "web_search"],
    });

    const composed = composeContextBudget({
      scaffold,
      threadMessages: thread,
      draftText,
      modelId: "openai/gpt-5.6-terra",
    });

    expect(composed.source).toBe("client");
    expect(composed.segments.find((s) => s.id === "system")?.tokens).toBe(scaffold.systemTokens);
    expect(composed.segments.find((s) => s.id === "tools")?.tokens).toBe(scaffold.toolsTokens);
    expect(composed.segments.find((s) => s.id === "summary")?.tokens).toBe(scaffold.summaryTokens);
    expect(composed.segments.find((s) => s.id === "memory")?.tokens).toBe(scaffold.memoryTokens);
    expect(composed.activeToolNames).toEqual(scaffold.activeToolNames);
    expect(composed.totalThreadMessages).toBe(2);
    expect(composed.segments.find((s) => s.id === "draft")?.tokens).toBeGreaterThan(0);
    expect(composed.segments.find((s) => s.id === "messages")?.tokens).toBeGreaterThan(0);
    expect(composed.segments.find((s) => s.id === "tool_output")?.tokens).toBeGreaterThan(0);
  });

  test("packs only the last N messages when scaffold sets a limit", () => {
    const thread = Array.from({ length: 12 }, (_, i) => userMessage(`Turn ${i + 1}`, `u${i}`));
    const composed = composeContextBudget({
      scaffold: fixtureScaffold({ contextMessageLimit: 10, summaryTokens: 600 }),
      threadMessages: thread,
      draftText: "",
      modelId: "openai/gpt-5.6-terra",
    });

    expect(composed.packedMessageCount).toBe(10);
    expect(composed.totalThreadMessages).toBe(12);
    expect(composed.includesRollingSummary).toBe(true);
  });

  test("scaffold JSON is numbers-only besides activeToolNames", () => {
    const scaffold = fixtureScaffold({
      memoriesInjected: 2,
      activeToolNames: ["web_search", "search_memories"],
    });
    const serialized = JSON.parse(JSON.stringify(scaffold)) as Record<string, unknown>;
    const allowedStringKeys = new Set(["source"]);

    for (const [key, value] of Object.entries(serialized)) {
      if (key === "activeToolNames") {
        expect(Array.isArray(value)).toBe(true);
        for (const name of value as unknown[]) {
          expect(typeof name).toBe("string");
        }
        continue;
      }

      if (allowedStringKeys.has(key)) {
        expect(typeof value).toBe("string");
        continue;
      }

      expect(typeof value === "number" || value === undefined).toBe(true);
    }
  });
});

describe("scaffoldFromStreamBudget", () => {
  test("round-trips segment tokens from a finalized budget", () => {
    const budget = finalizeContextBudget({
      modelId: "openai/gpt-5.6-terra",
      resolvedModelId: "openai/gpt-5.6-terra",
      segments: [
        { id: "system", label: "System prompt", tokens: 3_400, color: "x" },
        { id: "tools", label: "Tools", tokens: 1_200, color: "x" },
        { id: "summary", label: "Summary", tokens: 100, color: "x" },
        { id: "memory", label: "Memory", tokens: 900, color: "x" },
        { id: "messages", label: "Messages", tokens: 50, color: "x" },
      ],
      contextMessageLimit: 10,
      packedMessageCount: 2,
      totalThreadMessages: 2,
      includesRollingSummary: false,
      activeToolNames: ["manage_tasks"],
      memoriesInjected: 1,
      source: "server",
    });

    const scaffold = scaffoldFromStreamBudget(budget);

    expect(scaffold).toEqual({
      systemTokens: 3_400,
      toolsTokens: 1_200,
      summaryTokens: 100,
      memoryTokens: 900,
      memoriesInjected: 1,
      activeToolNames: ["manage_tasks"],
      contextMessageLimit: 10,
      source: "server",
    });

    const recomposed = composeContextBudget({
      scaffold,
      threadMessages: [userMessage("hi")],
      draftText: "draft",
      modelId: "openai/gpt-5.6-terra",
    });

    expect(recomposed.segments.find((s) => s.id === "system")?.tokens).toBe(3_400);
    expect(recomposed.segments.find((s) => s.id === "memory")?.tokens).toBe(900);
  });
});

describe("estimateTokenCount shared encoder", () => {
  test("sync estimate matches a fresh cl100k encode of the same text", () => {
    const sample = "user: Counting tokens with a shared cl100k encoder.";
    const sync = estimateTokenCountSync(sample);
    const fresh = encodingForModel("gpt-5").encode(sample.trim()).length;

    expect(sync).toBe(fresh);
  });
});

describe("context budget derivations", () => {
  test("returns null coverage for empty threads", () => {
    const budget = computeNewThreadDefaultBudget({
      modelId: "openai/gpt-5.6-terra",
      memoryEnabled: false,
      webSearchEnabled: false,
      messageSearchEnabled: false,
    });

    expect(getThreadContextCoverage(budget)).toBeNull();
  });

  test("computes partial thread coverage when the window is smaller than the thread", () => {
    const thread = Array.from({ length: 12 }, (_, i) => userMessage(`Turn ${i + 1}`, `u${i}`));
    const budget = computeContextBudget({
      modelId: "openai/gpt-5.6-terra",
      threadMessages: thread,
      draftText: "",
      contextMessageLimit: 10,
      memoryEnabled: false,
      webSearchEnabled: false,
      messageSearchEnabled: false,
    });

    expect(getThreadContextCoverage(budget)).toEqual({
      ratio: 10 / 12,
      percent: 83,
    });
  });

  test("computes headroom and composition from packed segments", () => {
    const budget = computeContextBudget({
      modelId: "openai/gpt-5.6-terra",
      threadMessages: [userMessage("Hello"), assistantWithToolOutput()],
      draftText: "Next question",
      memoryEnabled: false,
      webSearchEnabled: false,
      messageSearchEnabled: false,
    });

    expect(getContextHeadroomTurns(budget)).toBeGreaterThan(0);

    const composition = getContextComposition(budget);

    expect(composition).not.toBeNull();
    expect(composition!.conversationPercent).toBeGreaterThan(0);
    expect(composition!.scaffoldingPercent).toBeGreaterThan(0);
    expect(composition!.conversationPercent + composition!.scaffoldingPercent).toBe(100);
  });
});

describe("resolveChatModelId", () => {
  test("passes explicit model ids through unchanged", () => {
    expect(resolveChatModelId({ modelId: "openai/gpt-5.6-terra" })).toBe("openai/gpt-5.6-terra");
  });

  test("resolves Auto to Sonnet by default", () => {
    expect(resolveChatModelId({ modelId: AUTO_CHAT_MODEL_ID })).toBe(AUTO_RESOLVED_SONNET_MODEL_ID);
  });

  test("resolves Delphi Auto from draft complexity", () => {
    const resolved = resolveChatModelId({
      modelId: AUTO_CHAT_MODEL_ID,
      experience: "delphi",
      draftText: "Please analyze the trade-offs step by step in detail.",
      zeroDataRetention: true,
    });

    expect(resolved).not.toBe(AUTO_CHAT_MODEL_ID);
    expect(resolved).not.toBe(AUTO_RESOLVED_SONNET_MODEL_ID);
  });
});
