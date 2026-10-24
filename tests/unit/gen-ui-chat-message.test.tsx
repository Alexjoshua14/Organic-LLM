import { afterEach, describe, expect, mock, test } from "bun:test";
import type { UIMessage } from "ai";
import { cleanup } from "@testing-library/react";

import { ChatMessage } from "@/components/chat/chat-message";
import { mockModulePreservingReal } from "../helpers/module-mock";
import { render } from "../helpers/render";

import * as ttsContext from "@/lib/context/tts-context";
import { FIXTURE_ANSWER_CARD, FIXTURE_RESTAURANT_CARD } from "@/lib/schemas/gen-ui/fixtures";
import { ChatAIActionEnum } from "@/types/ai";

// Merged over the real module so the stub keeps `TTSProvider` and `useTTSOptional` for files
// loaded after this one. Deliberately not restored: other files register their own TTS stub at
// load time and rely on last-writer-wins, which restoring here breaks.
mockModulePreservingReal("@/lib/context/tts-context", ttsContext, {
  useTTSContext: () => ({
    speak: () => {},
    play: () => {},
    pause: () => {},
    stop: () => {},
    status: "ready" as const,
    currentText: null,
    audioRef: { current: null },
    deferPlaybackToUserGesture: false,
  }),
  TTSDockBar: () => null,
} as never);

mock.module("@/lib/user-settings", () => ({
  USER_SETTINGS_STORAGE_KEY: "organic-llm-user-settings",
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

mock.module("@/hooks/use-assistant-tts-action", () => ({
  useAssistantTtsAction: () => ({
    handleSpeak: () => {},
    isProcessingThisClip: false,
    showOverlay: false,
  }),
}));

mock.module("@/lib/tts/pinned-to-speak", () => ({
  addPinnedFromChat: async () => {},
}));

afterEach(() => cleanup());

function assistantWithGenUiTool(
  state: "input-streaming" | "output-available",
  output?: { block: typeof FIXTURE_ANSWER_CARD }
): UIMessage {
  return {
    id: "msg-gen-ui",
    role: "assistant",
    parts: [
      {
        type: "dynamic-tool",
        toolName: "render_gen_ui",
        toolCallId: "tc-gen-ui",
        state,
        input:
          state === "input-streaming"
            ? { type: "answer-card", version: 1, title: "Streaming" }
            : {},
        output: output ?? {},
      },
    ],
  };
}

describe("ChatMessage render_gen_ui", () => {
  test("output-available renders answer card title", () => {
    const message = assistantWithGenUiTool("output-available", { block: FIXTURE_ANSWER_CARD });
    const { getByText } = render(<ChatMessage message={message} />);
    expect(getByText(FIXTURE_ANSWER_CARD.tldr)).toBeTruthy();
  });

  test("input-streaming shows loading skeleton", () => {
    const message = assistantWithGenUiTool("input-streaming");
    const { getByLabelText } = render(<ChatMessage message={message} />);
    expect(getByLabelText(/Loading structured response/i)).toBeTruthy();
  });
});

describe("ChatMessage gather_restaurant", () => {
  test("hides completed gather_restaurant output when restaurant card renders", () => {
    const message: UIMessage = {
      id: "msg-restaurant",
      role: "assistant",
      parts: [
        {
          type: "dynamic-tool",
          toolName: "gather_restaurant",
          toolCallId: "tc-gather",
          state: "output-available",
          input: { name: FIXTURE_RESTAURANT_CARD.name },
          output: { status: "resolved", block: FIXTURE_RESTAURANT_CARD },
        },
        {
          type: "dynamic-tool",
          toolName: "render_gen_ui",
          toolCallId: "tc-gen-ui",
          state: "output-available",
          input: {},
          output: { block: FIXTURE_RESTAURANT_CARD },
        },
      ],
    };

    const { getByText, queryByText } = render(<ChatMessage message={message} />);
    expect(getByText(FIXTURE_RESTAURANT_CARD.name)).toBeTruthy();
    expect(queryByText("gather_restaurant")).toBeNull();
  });

  test("shows loading label while gather_restaurant is in flight", () => {
    const message: UIMessage = {
      id: "msg-restaurant-loading",
      role: "assistant",
      parts: [
        {
          type: "dynamic-tool",
          toolName: "gather_restaurant",
          toolCallId: "tc-gather",
          state: "input-available",
          input: { name: "Example Bistro" },
        },
      ],
    };

    const { getByText } = render(<ChatMessage message={message} />);
    expect(getByText("Looking up restaurant…")).toBeTruthy();
  });
});

function assistantWithReasoning(
  parts: Array<{ text: string; state: "streaming" | "done" }>
): UIMessage {
  return {
    id: "msg-reasoning",
    role: "assistant",
    parts: [
      ...parts.map((part) => ({ type: "reasoning" as const, ...part })),
      { type: "text", text: "Final answer.", state: "done" },
    ],
  };
}

describe("ChatMessage reasoning", () => {
  test("done reasoning with text renders one collapsed disclosure", () => {
    const message = assistantWithReasoning([
      { text: "First summary.", state: "done" },
      { text: "Second summary.", state: "done" },
    ]);
    const { getAllByRole, getByText } = render(<ChatMessage message={message} />);
    const triggers = getAllByRole("button", { name: /Reasoning/ });

    expect(triggers).toHaveLength(1);
    expect(triggers[0].getAttribute("aria-expanded")).toBe("false");
    expect(getByText("Final answer.")).toBeTruthy();
  });

  test("streaming reasoning with text shows one live disclosure", () => {
    const message = assistantWithReasoning([{ text: "Weighing options.", state: "streaming" }]);
    const { getAllByRole, container } = render(
      <ChatMessage aiActionPayload={{ action: ChatAIActionEnum.Reasoning }} message={message} />
    );

    expect(getAllByRole("button", { name: /Reasoning/ })).toHaveLength(1);
    // One burn label (its sr-only copy) — the tail action shimmer must not double it.
    const labels = [...container.querySelectorAll(".sr-only")].filter((el) =>
      el.textContent?.includes("Reasoning")
    );

    expect(labels).toHaveLength(1);
  });

  test("done reasoning without text renders nothing", () => {
    const message = assistantWithReasoning([{ text: "", state: "done" }]);
    const { queryByRole, queryByText } = render(<ChatMessage message={message} />);

    expect(queryByRole("button", { name: /Reasoning/ })).toBeNull();
    expect(queryByText(/Reasoning/)).toBeNull();
  });

  test("streaming reasoning without text keeps the shimmer label", () => {
    const message = assistantWithReasoning([{ text: "", state: "streaming" }]);
    const { queryByRole, container } = render(<ChatMessage message={message} />);

    expect(queryByRole("button", { name: /Reasoning/ })).toBeNull();
    expect(container.textContent).toContain("Reasoning");
  });
});

describe("ChatMessage OrganicToolCallPresence", () => {
  test("renders visual OrganicActivityMark presence for subagent dispatch, worktable, and rabbit hole tools", () => {
    const message: UIMessage = {
      id: "msg-organic-tools",
      role: "assistant",
      parts: [
        {
          type: "dynamic-tool",
          toolName: "dispatch_subagent",
          toolCallId: "tc-dispatch-lyra",
          state: "output-available",
          input: {
            agentId: "subagent-researcher",
            brief: "Synthesize speculative decoding benchmarks",
          },
          output: {
            success: true,
            agentId: "subagent-researcher",
            name: "Lyra",
            goalId: "goal-1",
          },
        },
        {
          type: "dynamic-tool",
          toolName: "worktable",
          toolCallId: "tc-worktable",
          state: "output-available",
          input: { op: "bundle" },
          output: { summary: "Packed 3 node summaries into worktable" },
        },
        {
          type: "dynamic-tool",
          toolName: "navigate_rabbit_hole_node",
          toolCallId: "tc-nav-node",
          state: "input-available",
          input: { title: "Tree Attention Verification" },
        },
      ],
    };

    const { getByText, container } = render(<ChatMessage message={message} />);

    expect(getByText("Dispatched to Lyra")).toBeTruthy();
    expect(getByText("Synthesize speculative decoding benchmarks")).toBeTruthy();
    expect(getByText("Crafting context bundle")).toBeTruthy();
    expect(getByText("Navigating branch…")).toBeTruthy();
    expect(container.querySelectorAll("[data-organic-tool-presence]")).toHaveLength(3);
    expect(container.querySelectorAll('[role="img"][data-activity-state]')).toHaveLength(3);
  });
});
