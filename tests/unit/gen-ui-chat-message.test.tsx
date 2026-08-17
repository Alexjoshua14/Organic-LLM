import { afterEach, describe, expect, mock, test } from "bun:test";
import type { UIMessage } from "ai";
import { cleanup } from "@testing-library/react";

import { ChatMessage } from "@/components/chat/chat-message";
import { render } from "../helpers/render";
import { FIXTURE_ANSWER_CARD, FIXTURE_RESTAURANT_CARD } from "@/lib/schemas/gen-ui/fixtures";

mock.module("@/lib/context/tts-context", () => ({
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
}));

mock.module("@/lib/user-settings", () => ({
  USER_SETTINGS_STORAGE_KEY: "organic-llm-user-settings",
  getSettings: () => ({
    fontId: "satoshi",
    ttsWholeMessage: true,
    zeroDataRetention: false,
    coalescenceMode: false,
    experimentalArcadiaMarkdownPreview: false,
  }),
}));

mock.module("@/hooks/use-assistant-tts-action", () => ({
  useAssistantTtsAction: () => ({
    handleSpeak: () => {},
    isProcessingThisClip: false,
    showOverlay: false,
  }),
}));

mock.module("@/app/actions/spatial-artifacts", () => ({
  actionPinSpatialArtifact: async () => ({ ok: true, artifactId: "test" }),
}));

mock.module("@/lib/tts/pinned-to-speak", () => ({
  addPinnedFromChat: async () => {},
}));

mock.module("sonner", () => ({
  toast: { success: () => {}, error: () => {} },
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
        input: state === "input-streaming" ? { type: "answer-card", version: 1, title: "Streaming" } : {},
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
