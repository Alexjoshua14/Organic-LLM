import { afterEach, describe, expect, mock, test } from "bun:test";
import type { UIMessage } from "ai";
import { cleanup } from "@testing-library/react";

import { ChatMessage } from "@/components/chat/chat-message";
import { mockModulePreservingReal } from "../helpers/module-mock";
import { render } from "../helpers/render";

import * as ttsContext from "@/lib/context/tts-context";
import { FIXTURE_INITIATE, FIXTURE_UPSERT } from "@/lib/schemas/kanban/fixtures";

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

describe("ChatMessage showActions", () => {
  test("hides assistant action row when showActions is false", () => {
    const message: UIMessage = {
      id: "msg-actions",
      role: "assistant",
      parts: [{ type: "text", text: "Hello from the board.", state: "done" }],
    };

    const { queryByLabelText } = render(<ChatMessage message={message} showActions={false} />);

    expect(queryByLabelText(/Read aloud/i)).toBeNull();
  });

  test("shows assistant action row by default", () => {
    const message: UIMessage = {
      id: "msg-actions-default",
      role: "assistant",
      parts: [{ type: "text", text: "Hello from the board.", state: "done" }],
    };

    const { getByLabelText } = render(<ChatMessage message={message} />);

    expect(getByLabelText(/Read aloud/i)).toBeTruthy();
  });
});

describe("ChatMessage kanban loading", () => {
  test("INITIATE_KANBAN in flight shows full loading shell", () => {
    const message: UIMessage = {
      id: "msg-kanban-init",
      role: "assistant",
      parts: [
        {
          type: "dynamic-tool",
          toolName: "kanban_board",
          toolCallId: "tc-init",
          state: "input-streaming",
          input: { command: FIXTURE_INITIATE },
        },
      ],
    };

    const { getByLabelText } = render(<ChatMessage chatId="t1" message={message} />);

    expect(getByLabelText(/Initializing board/i)).toBeTruthy();
  });

  test("UPSERT_ITEMS in flight shows compact updating row", () => {
    const message: UIMessage = {
      id: "msg-kanban-upsert",
      role: "assistant",
      parts: [
        {
          type: "dynamic-tool",
          toolName: "kanban_board",
          toolCallId: "tc-upsert",
          state: "input-streaming",
          input: { command: FIXTURE_UPSERT },
        },
      ],
    };

    const { getByText, queryByLabelText } = render(
      <ChatMessage chatId="t1" message={message} />
    );

    expect(getByText("Updating board…")).toBeTruthy();
    expect(queryByLabelText(/Initializing board/i)).toBeNull();
  });
});
