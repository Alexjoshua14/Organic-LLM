"use client";

import { useCallback, useRef } from "react";
import { ChatStatus } from "ai";
import { useChat } from "@ai-sdk/react";

import { NewChatInput } from "@/components/chat/new-chat-input";
import { ChatModel, DEFAULT_CHAT_MODEL } from "@/lib/schemas/chat";
import { PromptInputProvider } from "@/components/third-party/ai-elements/prompt-input";

interface RabbitHolePromptBarProps {
  onStart: (question: string) => void;
  onReset: () => void;
  hasSession: boolean;
  isBusy: boolean;
  isLoading: boolean;
}

export function RabbitHolePromptBar({
  onStart,
  onReset,
  hasSession,
  isBusy,
  isLoading,
}: RabbitHolePromptBarProps) {
  // Create refs for NewChatInput (these features aren't used in rabbit hole but are required)
  const modelRef = useRef<ChatModel>(DEFAULT_CHAT_MODEL);
  const useWebSearchRef = useRef<boolean>(false);
  const useMemoriesRef = useRef<boolean>(false);

  // Adapt onStart to the sendMessage interface expected by NewChatInput
  const sendMessage: ReturnType<typeof useChat>["sendMessage"] = useCallback(
    async (message) => {
      if (message && "text" in message && message.text?.trim()) {
        onStart(message.text.trim());
      }
      // NewChatInput expects a Promise return; we don't use it for rabbit holes.
      return undefined as unknown as ReturnType<
        ReturnType<typeof useChat>["sendMessage"]
      >;
    },
    [onStart],
  );

  // Adapt onReset to return a Promise as expected by stop
  const stop: ReturnType<typeof useChat>["stop"] = useCallback(async () => {
    onReset();
  }, [onReset]);

  // Map isLoading to ChatStatus
  const status: ChatStatus = isBusy ? "streaming" : "ready";

  return (
    <PromptInputProvider>
      <NewChatInput
        modelRef={modelRef}
        useWebSearchRef={useWebSearchRef}
        useMemoriesRef={useMemoriesRef}
        sendMessage={sendMessage}
        stop={stop}
        status={status}
        disabled={isLoading}
      />
    </PromptInputProvider>
  );
}

