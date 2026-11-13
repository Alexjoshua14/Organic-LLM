import { afterEach, describe, expect, mock, test } from "bun:test";
import { act, cleanup, waitFor } from "@testing-library/react";
import { useMemo, useState } from "react";
import type { UIMessage } from "ai";

import { useThreadContextBudget } from "@/hooks/use-thread-context-budget";
import {
  composeContextBudget,
  finalizeContextBudget,
  type ContextBudgetScaffold,
  type TextTokenCounter,
} from "@/lib/chat/context-budget";
import { estimateTokenCountSync } from "@/lib/chat/tokenizer";
import { render } from "../helpers/render";

mock.module("@/lib/user-settings", () => ({
  getSettings: () => ({
    fontId: "satoshi",
    ttsWholeMessage: true,
    zeroDataRetention: false,
    coalescenceMode: false,
    experimentalArcadiaMarkdownPreview: false,
    experimentalContextEffort: false,
    experimentalKnowledgeCapsuleTitles: false,
    contextEffortLevel: "quick",
  }),
}));

const fetchCalls: Array<{ url: string; body: Record<string, unknown> }> = [];

const originalFetch = globalThis.fetch;

/** The thread the hook counts. Stable across renders, as `chat.tsx` keeps it. */
const HELLO_THREAD: UIMessage[] = [
  { id: "u1", role: "user", parts: [{ type: "text", text: "Hello" }] },
];

const SCAFFOLD: ContextBudgetScaffold = {
  systemTokens: 3400,
  toolsTokens: 1100,
  summaryTokens: 0,
  memoryTokens: 0,
  activeToolNames: ["manage_tasks"],
  contextMessageLimit: 10,
  source: "server",
};

/** Counts on the test's thread instead of the background counter (and its worker). */
const syncCounter: TextTokenCounter = async (texts) => texts.map(estimateTokenCountSync);

/** A counter whose answers a test can hold back, to land them after a thread switch. */
function holdableCounter() {
  const calls: string[][] = [];
  const held: Array<() => void> = [];
  let holding = false;
  const counter: TextTokenCounter = (texts) => {
    calls.push(texts);
    const counts = texts.map(estimateTokenCountSync);

    if (!holding) return Promise.resolve(counts);

    return new Promise((resolve) => held.push(() => resolve(counts)));
  };

  return {
    calls,
    counter,
    hold: (value: boolean) => {
      holding = value;
    },
    release: () => {
      for (const resolve of held.splice(0)) resolve();
    },
  };
}

/** Idle callbacks run only when a test flushes them, each with no idle time left. */
const idleQueue = new Map<number, IdleRequestCallback>();
let nextIdleHandle = 1;

function installManualIdle() {
  window.requestIdleCallback = ((callback: IdleRequestCallback) => {
    const handle = nextIdleHandle++;

    idleQueue.set(handle, callback);

    return handle;
  }) as typeof window.requestIdleCallback;
  window.cancelIdleCallback = (handle: number) => {
    idleQueue.delete(handle);
  };
}

/** Runs the queued idle slices once; returns how many ran. */
function flushIdleOnce(): number {
  const callbacks = [...idleQueue.values()];

  idleQueue.clear();
  act(() => {
    for (const callback of callbacks) callback({ didTimeout: false, timeRemaining: () => 0 });
  });

  return callbacks.length;
}

function flushIdle() {
  for (let slices = 0; flushIdleOnce() > 0; slices++) {
    if (slices > 1_000) throw new Error("idle work never finished");
  }
}

afterEach(() => {
  cleanup();
  fetchCalls.length = 0;
  globalThis.fetch = originalFetch;
  idleQueue.clear();
  Reflect.deleteProperty(window, "requestIdleCallback");
  Reflect.deleteProperty(window, "cancelIdleCallback");
});

function mockBudgetFetch() {
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const body = JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>;

    fetchCalls.push({ url, body });

    if (body.mode === "scaffold") {
      return new Response(JSON.stringify({ scaffold: SCAFFOLD }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
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

/** A user message whose text counts how often it is read, i.e. tokenized. */
function readCountedMessage(id: string, reads: Map<string, number>): UIMessage {
  return {
    id,
    role: "user",
    parts: [
      {
        type: "text",
        get text() {
          reads.set(id, (reads.get(id) ?? 0) + 1);

          return `Turn ${id}`;
        },
      },
    ],
  };
}

function HookProbe(props: {
  threadMessages?: UIMessage[];
  draftText: string;
  memoryEnabled?: boolean;
  chatId?: string;
  countTokens?: TextTokenCounter;
}) {
  const budget = useThreadContextBudget({
    chatId: props.chatId ?? "11111111-1111-4111-8111-111111111111",
    modelId: "openai/gpt-6-sol",
    draftText: props.draftText,
    memoryEnabled: props.memoryEnabled ?? false,
    webSearchEnabled: false,
    messageSearchEnabled: false,
    threadMessages: props.threadMessages,
    draftDebounceMs: 20,
    countTokens: props.countTokens ?? syncCounter,
  });

  return (
    <div
      data-source={budget.source ?? "unknown"}
      data-next={budget.nextSubmitTokens}
      data-draft-tokens={budget.segments.find((s) => s.id === "draft")?.tokens ?? 0}
      data-packed={budget.packedMessageCount}
      data-total={budget.totalThreadMessages}
    />
  );
}

function DraftToggleCompose() {
  const [draft, setDraft] = useState("first");
  const [memoryEnabled, setMemoryEnabled] = useState(false);

  return (
    <div>
      <button type="button" onClick={() => setDraft("second draft much longer")}>
        change-draft
      </button>
      <button type="button" onClick={() => setMemoryEnabled((v) => !v)}>
        toggle-memory
      </button>
      <HookProbe draftText={draft} memoryEnabled={memoryEnabled} threadMessages={HELLO_THREAD} />
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

  const budget = useThreadContextBudget({
    chatId: "11111111-1111-4111-8111-111111111111",
    modelId: "openai/gpt-6-sol",
    draftText: "",
    memoryEnabled: false,
    webSearchEnabled: false,
    messageSearchEnabled: false,
    threadMessages: HELLO_THREAD,
    streamBudget,
    draftDebounceMs: 20,
    countTokens: syncCounter,
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

  test("client compose: counts the thread only when the browser is idle", async () => {
    installManualIdle();
    mockBudgetFetch();
    const reads = new Map<string, number>();
    const thread = Array.from({ length: 12 }, (_, i) => readCountedMessage(`m${i}`, reads));
    const counting = holdableCounter();
    const { container } = render(
      <HookProbe countTokens={counting.counter} draftText="" threadMessages={thread} />
    );
    const probe = () => container.querySelector("[data-source]");

    await waitFor(() => expect(fetchCalls.length).toBe(1));
    // The scaffold has arrived and the count is queued, but nothing has been counted.
    await waitFor(() => expect(idleQueue.size).toBe(1));
    expect(reads.size).toBe(0);
    expect(counting.calls.length).toBe(0);
    expect(probe()?.getAttribute("data-source")).not.toBe("client");

    flushIdle();
    await waitFor(() => expect(probe()?.getAttribute("data-source")).toBe("client"));

    // The packed tail's text, then its tool parts (the scaffold packs the last 10).
    expect(counting.calls.map((texts) => texts.length)).toEqual([10, 10]);

    const expected = composeContextBudget({
      scaffold: SCAFFOLD,
      threadMessages: thread,
      draftText: "",
      modelId: "openai/gpt-6-sol",
    });

    expect(Number(probe()?.getAttribute("data-next"))).toBe(expected.nextSubmitTokens);
    expect(Number(probe()?.getAttribute("data-packed"))).toBe(expected.packedMessageCount);
  });

  test("client compose: switching threads drops the old thread's count", async () => {
    installManualIdle();
    mockBudgetFetch();
    const reads = new Map<string, number>();
    const first = Array.from({ length: 8 }, (_, i) => readCountedMessage(`a${i}`, reads));
    const second = Array.from({ length: 3 }, (_, i) => readCountedMessage(`b${i}`, reads));
    const counting = holdableCounter();
    const { container, rerender } = render(
      <HookProbe
        chatId="thread-a"
        countTokens={counting.counter}
        draftText=""
        threadMessages={first}
      />
    );

    await waitFor(() => expect(idleQueue.size).toBe(1));
    counting.hold(true);
    flushIdle();
    expect(counting.calls.length).toBe(1);

    rerender(
      <HookProbe
        chatId="thread-b"
        countTokens={counting.counter}
        draftText=""
        threadMessages={second}
      />
    );
    await waitFor(() => expect(fetchCalls.length).toBe(2));
    await waitFor(() => expect(idleQueue.size).toBe(1));

    // The first thread's answer lands after the switch: it must not continue or compose.
    counting.hold(false);
    await act(async () => {
      counting.release();
    });
    flushIdle();

    const probe = () => container.querySelector("[data-source]");

    await waitFor(() => expect(probe()?.getAttribute("data-source")).toBe("client"));
    expect(Number(probe()?.getAttribute("data-total"))).toBe(second.length);
    expect(counting.calls.filter((texts) => texts.length === first.length)).toHaveLength(1);
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
