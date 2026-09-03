import { afterEach, beforeAll, describe, expect, mock, test } from "bun:test";
import type { ReactElement } from "react";
import type { UIMessage } from "ai";
import { cleanup } from "@testing-library/react";

import { ChatThread } from "@/components/chat/chat-thread";
import { Conversation } from "@/components/third-party/ai-elements/conversation";
import { OPTIMISTIC_MESSAGE_RECEIVED_LABEL } from "@/lib/chat/optimistic-ai-action";
import { ChatAIActionEnum } from "@/types/ai";
import { render } from "../helpers/render";

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

mock.module("@/lib/tts/pinned-to-speak", () => ({
  addPinnedFromChat: async () => {},
}));

beforeAll(() => {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as typeof ResizeObserver;
});

afterEach(() => cleanup());

const userMessage: UIMessage = {
  id: "u1",
  role: "user",
  parts: [{ type: "text", text: "What are white holes?" }],
};

function renderThread(
  ui: ReactElement = (
    <Conversation>
      <ChatThread messages={[userMessage]} status="submitted" />
    </Conversation>
  )
) {
  return render(ui);
}

describe("ChatThread optimistic receipt", () => {
  test("shows Reading after the user bubble as soon as the turn is submitted", () => {
    const { getByText } = renderThread();

    expect(getByText("What are white holes?")).toBeTruthy();
    expect(getByText(OPTIMISTIC_MESSAGE_RECEIVED_LABEL)).toBeTruthy();
  });

  test("does not show a receipt on an idle user-last thread", () => {
    const { queryByText } = render(
      <Conversation>
        <ChatThread messages={[userMessage]} status="ready" />
      </Conversation>
    );

    expect(queryByText(OPTIMISTIC_MESSAGE_RECEIVED_LABEL)).toBeNull();
  });

  test("replaces the optimistic label with stream processing copy", () => {
    const { getByText, queryByText } = render(
      <Conversation>
        <ChatThread
          aiActionPayload={{
            action: ChatAIActionEnum.Processing,
            message: "Gathering context",
          }}
          messages={[userMessage]}
          status="submitted"
        />
      </Conversation>
    );

    expect(getByText("Gathering context")).toBeTruthy();
    expect(queryByText(OPTIMISTIC_MESSAGE_RECEIVED_LABEL)).toBeNull();
  });
});
