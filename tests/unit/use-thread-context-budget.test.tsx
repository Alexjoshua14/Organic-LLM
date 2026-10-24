import { afterEach, describe, expect, mock, test } from "bun:test";
import { cleanup, waitFor } from "@testing-library/react";
import { useMemo, useState } from "react";
import type { UIMessage } from "ai";

import { useThreadContextBudget } from "@/hooks/use-thread-context-budget";
import { finalizeContextBudget } from "@/lib/chat/context-budget";
import { render } from "../helpers/render";

mock.module("@/lib/user-settings", () => ({
  getSettings: () => ({
    fontId: "satoshi",
    ttsWholeMessage: true,
    zeroDataRetention: false,
    coalescenceMode: false,
    experimentalArcadiaMarkdownPreview: false,
    experimentalContextEffort: false,
    contextEffortLevel: "quick",
  }),
}));

const fetchCalls: Array<{ url: string; body: Record<string, unknown> }> = [];

const originalFetch = globalThis.fetch;

afterEach(() => {
  cleanup();
  fetchCalls.length = 0;
  globalThis.fetch = originalFetch;
});

function mockBudgetFetch() {
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const body = JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>;

    fetchCalls.push({ url, body });

    if (body.mode === "scaffold") {
      return new Response(
        JSON.stringify({
          scaffold: {
            systemTokens: 3400,
            toolsTokens: 1100,
            summaryTokens: 0,
            memoryTokens: 0,
            activeToolNames: ["manage_tasks"],
            contextMessageLimit: 10,
            source: "server",
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        budget: {
          modelId: "openai/gpt-6-sol",
          contextWindowTokens: 1_050_000,
          reservedOutputTokens: 8_192,
          inputBudgetTokens: 1_041_808,
          nextSubmitTokens: 4_500,
          remainingInputTokens: 1_037_308,
          fillRatio: 0.004,
          contextMessageLimit: 10,
          packedMessageCount: 0,
          totalThreadMessages: 0,
          includesRollingSummary: false,
          segments: [
            {
              id: "system",
              label: "System prompt",
              tokens: 3400,
              color: "hsl(199 89% 48% / 0.82)",
            },
          ],
          source: "server",
        },
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  }) as typeof fetch;
}

function HookProbe(props: {
  threadMessages?: UIMessage[];
  draftText: string;
  memoryEnabled?: boolean;
}) {
  const budget = useThreadContextBudget({
    chatId: "11111111-1111-4111-8111-111111111111",
    modelId: "openai/gpt-6-sol",
    draftText: props.draftText,
    memoryEnabled: props.memoryEnabled ?? false,
    webSearchEnabled: false,
    messageSearchEnabled: false,
    threadMessages: props.threadMessages,
    draftDebounceMs: 20,
  });

  return (
    <div
      data-source={budget.source ?? "unknown"}
      data-next={budget.nextSubmitTokens}
      data-draft-tokens={budget.segments.find((s) => s.id === "draft")?.tokens ?? 0}
    />
  );
}

function DraftToggleCompose() {
  const [draft, setDraft] = useState("first");
  const [memoryEnabled, setMemoryEnabled] = useState(false);
  const messages: UIMessage[] = [
    { id: "u1", role: "user", parts: [{ type: "text", text: "Hello" }] },
  ];

  return (
    <div>
      <button type="button" onClick={() => setDraft("second draft much longer")}>
        change-draft
      </button>
      <button type="button" onClick={() => setMemoryEnabled((v) => !v)}>
        toggle-memory
      </button>
      <HookProbe draftText={draft} memoryEnabled={memoryEnabled} threadMessages={messages} />
    </div>
  );
}

function LegacyPollProbe() {
  const [draft, setDraft] = useState("first");

  return (
    <div>
      <button type="button" onClick={() => setDraft("second")}>
        change-draft
      </button>
      <HookProbe draftText={draft} />
    </div>
  );
}

function LastTurnProbe() {
  const streamBudget = useMemo(
    () =>
      finalizeContextBudget({
        modelId: "openai/gpt-6-sol",
        segments: [
          { id: "system", label: "System prompt", tokens: 3400, color: "x" },
          { id: "memory", label: "Memory", tokens: 800, color: "x" },
        ],
        contextMessageLimit: 10,
        packedMessageCount: 1,
        totalThreadMessages: 1,
        includesRollingSummary: false,
        memoriesInjected: 7,
        lastTurn: { inputTokens: 12_345, memoryTokens: 800, memoriesInjected: 7 },
        source: "server",
      }),
    []
  );
  const messages: UIMessage[] = [
    { id: "u1", role: "user", parts: [{ type: "text", text: "Hello" }] },
  ];

  const budget = useThreadContextBudget({
    chatId: "11111111-1111-4111-8111-111111111111",
    modelId: "openai/gpt-6-sol",
    draftText: "",
    memoryEnabled: false,
    webSearchEnabled: false,
    messageSearchEnabled: false,
    threadMessages: messages,
    streamBudget,
    draftDebounceMs: 20,
  });

  return (
    <div
      data-last-input={budget.lastTurn?.inputTokens ?? ""}
      data-last-mem={budget.lastTurn?.memoriesInjected ?? ""}
    />
  );
}

describe("useThreadContextBudget", () => {
  test("client compose: draft change does not refetch scaffold; toggle does", async () => {
    mockBudgetFetch();
    const { getByText, container } = render(<DraftToggleCompose />);

    await waitFor(() => {
      expect(fetchCalls.length).toBe(1);
      expect(fetchCalls[0]?.body.mode).toBe("scaffold");
      expect(fetchCalls[0]?.body.contextEffort).toBeUndefined();
    });

    getByText("change-draft").click();

    await waitFor(() => {
      const draftTokens = Number(
        container.querySelector("[data-draft-tokens]")?.getAttribute("data-draft-tokens")
      );

      expect(draftTokens).toBeGreaterThan(0);
    });

    expect(fetchCalls.length).toBe(1);

    getByText("toggle-memory").click();

    await waitFor(() => {
      expect(fetchCalls.length).toBe(2);
      expect(fetchCalls[1]?.body.mode).toBe("scaffold");
      expect(fetchCalls[1]?.body.memory).toBe(true);
    });
  });

  test("legacy poll: draft change triggers budget fetch when threadMessages absent", async () => {
    mockBudgetFetch();
    const { getByText } = render(<LegacyPollProbe />);

    await waitFor(() => {
      expect(fetchCalls.length).toBe(1);
      expect(fetchCalls[0]?.body.mode).toBe("budget");
    });

    getByText("change-draft").click();

    await waitFor(() => {
      expect(fetchCalls.length).toBe(2);
      expect(fetchCalls[1]?.body.mode).toBe("budget");
      expect(fetchCalls[1]?.body.draftText).toBe("second");
    });
  });

  test("client compose: scaffold poll keeps last-send metrics from the stream budget", async () => {
    mockBudgetFetch();
    const { container } = render(<LastTurnProbe />);

    await waitFor(() => {
      expect(fetchCalls.length).toBe(1);
      expect(container.querySelector("[data-last-input]")?.getAttribute("data-last-input")).toBe(
        "12345"
      );
      expect(container.querySelector("[data-last-mem]")?.getAttribute("data-last-mem")).toBe("7");
    });
  });
});
