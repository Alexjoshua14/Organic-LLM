import { afterEach, describe, expect, mock, test } from "bun:test";
import type { UIMessage } from "ai";
import { cleanup } from "@testing-library/react";

import { ChatMessage } from "@/components/chat/chat-message";
import { render } from "../helpers/render";
import { FIXTURE_ANSWER_CARD } from "@/lib/schemas/gen-ui/fixtures";

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
    expect(getByText(FIXTURE_ANSWER_CARD.title)).toBeTruthy();
  });

  test("input-streaming shows loading skeleton", () => {
    const message = assistantWithGenUiTool("input-streaming");
    const { getByLabelText } = render(<ChatMessage message={message} />);
    expect(getByLabelText(/Loading structured response/i)).toBeTruthy();
  });
});
