import { afterEach, beforeAll, beforeEach, describe, expect, mock, test } from "bun:test";
import type { ComponentProps, ReactNode } from "react";
import { cleanup, fireEvent, waitFor } from "@testing-library/react";

import { render } from "../helpers/render";

const mockSpeak = mock(() => {});
const mockPlay = mock(() => {});
const mockAddPinnedFromChat = mock(async () => {});
const mockToastSuccess = mock(() => {});
const mockToastError = mock(() => {});
const mockWriteText = mock(async () => Promise.resolve());

const settingsState = { ttsWholeMessage: true };

mock.module("@/lib/context/tts-context", () => ({
  useTTSContext: () => ({
    speak: mockSpeak,
    play: mockPlay,
    pause: () => {},
    stop: () => {},
    status: "ready" as const,
    currentText: null as string | null,
    audioRef: { current: null },
    deferPlaybackToUserGesture: false,
  }),
  TTSDockBar: () => null,
}));

mock.module("@/lib/user-settings", () => ({
  getSettings: () => ({
    fontId: "satoshi",
    ttsWholeMessage: settingsState.ttsWholeMessage,
    zeroDataRetention: false,
    coalescenceMode: false,
    experimentalArcadiaMarkdownPreview: false,
  }),
}));

mock.module("@/lib/tts/pinned-to-speak", () => ({
  addPinnedFromChat: mockAddPinnedFromChat,
}));

mock.module("sonner", () => ({
  toast: {
    success: mockToastSuccess,
    error: mockToastError,
  },
}));

mock.module("@heroui/button", () => ({
  Button: ({
    children,
    onPress,
    isDisabled,
    isIconOnly: _isIconOnly,
    variant: _variant,
    size: _size,
    tabIndex,
    onClick: triggerOnClick,
    ...rest
  }: {
    children: ReactNode;
    onPress?: () => void;
    isDisabled?: boolean;
    isIconOnly?: boolean;
    variant?: string;
    size?: string;
    tabIndex?: number;
  } & ComponentProps<"button">) => (
    <button
      disabled={isDisabled}
      tabIndex={tabIndex}
      type="button"
      {...rest}
      onClick={(e) => {
        triggerOnClick?.(e);
        onPress?.();
      }}
    >
      {children}
    </button>
  ),
}));

type AssistantMessageActionsProps = { text: string; showPinAndCopy: boolean };
let AssistantMessageActions: (props: AssistantMessageActionsProps) => ReactNode;

const TTS_LABEL = "Read aloud";
const PIN_LABEL =
  "Pin to Speak — save on the Speak page to generate or download audio.";
const COPY_LABEL = "Copy this message.";

describe("AssistantMessageActions", () => {
  beforeAll(async () => {
    const mod = await import("@/components/chat/assistant-message-actions");
    AssistantMessageActions = mod.AssistantMessageActions;
  });

  afterEach(() => {
    cleanup();
    document.body.innerHTML = "";
  });

  beforeEach(() => {
    mockSpeak.mockReset();
    mockPlay.mockReset();
    mockAddPinnedFromChat.mockReset();
    mockToastSuccess.mockReset();
    mockToastError.mockReset();
    mockWriteText.mockReset();
    settingsState.ttsWholeMessage = true;
    Object.defineProperty(globalThis.navigator, "clipboard", {
      configurable: true,
      value: { writeText: mockWriteText },
    });
  });

  test("renders three icon actions when showPinAndCopy is true", () => {
    const view = render(<AssistantMessageActions showPinAndCopy text="Hello assistant" />);
    expect(view.getByRole("button", { name: TTS_LABEL })).toBeTruthy();
    expect(view.getByRole("button", { name: PIN_LABEL })).toBeTruthy();
    expect(view.getByRole("button", { name: COPY_LABEL })).toBeTruthy();
  });

  test("renders only TTS when showPinAndCopy is false", () => {
    const view = render(<AssistantMessageActions showPinAndCopy={false} text="Help only" />);
    expect(view.getByRole("button", { name: TTS_LABEL })).toBeTruthy();
    expect(view.queryByRole("button", { name: PIN_LABEL })).toBeNull();
    expect(view.queryByRole("button", { name: COPY_LABEL })).toBeNull();
  });

  test("copy uses clipboard.writeText with full message text", async () => {
    const body = "Copy me\nplease";
    const view = render(<AssistantMessageActions showPinAndCopy text={body} />);
    fireEvent.click(view.getByRole("button", { name: COPY_LABEL }));
    await waitFor(() => {
      expect(mockWriteText.mock.calls[0]?.[0]).toBe(body);
    });
    expect(mockToastSuccess).toHaveBeenCalled();
  });

  test("pin calls addPinnedFromChat with message text", async () => {
    mockAddPinnedFromChat.mockResolvedValue(undefined);
    const view = render(<AssistantMessageActions showPinAndCopy text="  pin body  " />);
    fireEvent.click(view.getByRole("button", { name: PIN_LABEL }));
    await waitFor(() => {
      expect(mockAddPinnedFromChat).toHaveBeenCalledWith("  pin body  ");
    });
    expect(mockToastSuccess).toHaveBeenCalled();
  });

  test("TTS invokes speak with full text when ttsWholeMessage is true", () => {
    settingsState.ttsWholeMessage = true;
    const body = "A\n\nB";
    const view = render(<AssistantMessageActions showPinAndCopy={false} text={body} />);
    fireEvent.click(view.getByRole("button", { name: TTS_LABEL }));
    expect(mockSpeak).toHaveBeenCalledTimes(1);
    expect(mockSpeak.mock.calls[0]?.[0]).toBe(body);
  });
});
