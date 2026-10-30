import { afterEach, beforeAll, describe, expect, mock, test } from "bun:test";
import type { ReactElement } from "react";
import type { UIMessage } from "ai";
import { cleanup } from "@testing-library/react";

import { ChatThread } from "@/components/chat/chat-thread";
import { Conversation } from "@/components/third-party/ai-elements/conversation";
import { OPTIMISTIC_MESSAGE_RECEIVED_LABEL } from "@/lib/chat/optimistic-ai-action";
import { ChatAIActionEnum } from "@/types/ai";
import { mockModulePreservingReal } from "../helpers/module-mock";
import { render } from "../helpers/render";

import * as ttsContext from "@/lib/context/tts-context";

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

  // The stream's `start` chunk creates the assistant message before it has anything to show.
  describe.each([
    ["no parts", []],
    ["only a step marker", [{ type: "step-start" }]],
  ] as Array<[string, UIMessage["parts"]]>)("assistant message with %s", (_name, parts) => {
    const emptyAssistant: UIMessage = { id: "a1", role: "assistant", parts };

    test("keeps the receipt until the stream reports a status", () => {
      const { getByText } = render(
        <Conversation>
          <ChatThread messages={[userMessage, emptyAssistant]} status="streaming" />
        </Conversation>
      );

      expect(getByText(OPTIMISTIC_MESSAGE_RECEIVED_LABEL)).toBeTruthy();
    });

    test("shows the stream's status", () => {
      const { getByText } = render(
        <Conversation>
          <ChatThread
            aiActionPayload={{ action: ChatAIActionEnum.Processing, message: "Gathering context" }}
            messages={[userMessage, emptyAssistant]}
            status="streaming"
          />
        </Conversation>
      );

      expect(getByText("Gathering context")).toBeTruthy();
    });

    test("shows nothing once the turn is over", () => {
      const { queryByText } = render(
        <Conversation>
          <ChatThread messages={[userMessage, emptyAssistant]} status="ready" />
        </Conversation>
      );

      expect(queryByText(OPTIMISTIC_MESSAGE_RECEIVED_LABEL)).toBeNull();
    });
  });

  test("hands the status to the assistant row, once, when the first content arrives", () => {
    const { getAllByText } = render(
      <Conversation>
        <ChatThread
          aiActionPayload={{ action: ChatAIActionEnum.Search, message: "Searching" }}
          messages={[
            userMessage,
            {
              id: "a1",
              role: "assistant",
              parts: [{ type: "text", text: "Let me check.", state: "done" }],
            },
          ]}
          status="streaming"
        />
      </Conversation>
    );

    expect(getAllByText("Searching the web...")).toHaveLength(1);
  });
});
