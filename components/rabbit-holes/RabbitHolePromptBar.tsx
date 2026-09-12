"use client";

import type { ChatStatus } from "ai";
import type { useChat } from "@ai-sdk/react";

import { useRef } from "react";

import { CoreInput } from "@/components/chat/core-input";
import { ChatModel, DEFAULT_CHAT_MODEL } from "@/lib/schemas/chat";
import { PromptInputProvider } from "@/components/third-party/ai-elements/prompt-input";

interface RabbitHolePromptBarProps {
  sendMessage: ReturnType<typeof useChat>["sendMessage"];
  status?: ChatStatus;
  stop?: ReturnType<typeof useChat>["stop"];
  onReset: () => void;
  isBusy: boolean;
  isLoading: boolean;
  disabled?: boolean;
}

export function RabbitHolePromptBar({
  sendMessage,
  status: statusProp,
  stop,
  onReset,
  isBusy,
  isLoading,
  disabled,
}: RabbitHolePromptBarProps) {
  const modelRef = useRef<ChatModel>(DEFAULT_CHAT_MODEL);
  const useWebSearchRef = useRef<boolean>(false);
  const useMemoriesRef = useRef<boolean>(false);

  const status: ChatStatus = statusProp ?? (isBusy ? "streaming" : "ready");

  return (
    <PromptInputProvider>
      <CoreInput
        disabled={disabled ?? isLoading}
        hideWebMemorySpeechToggles
        modelRef={modelRef}
        sendMessage={sendMessage}
        status={status}
        stop={stop ?? (async () => {})}
        useMemoriesRef={useMemoriesRef}
        useWebSearchRef={useWebSearchRef}
        variant="compact"
      />
    </PromptInputProvider>
  );
}
