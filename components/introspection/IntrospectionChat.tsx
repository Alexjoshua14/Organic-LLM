"use client";

import type { IntrospectionGuidedState } from "@/lib/schemas/introspection";

import { UIMessage, useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { IntrospectionShell } from "./IntrospectionShell";
import { useIntrospectionGuidedState } from "./useIntrospectionGuidedState";

import { CoreInput } from "@/components/chat/core-input";
import { getChatErrorMessage } from "@/lib/chat/error-messages";
import { getSettings } from "@/lib/user-settings";
import { createLogger } from "@/lib/logger";
import { useSharedChatContext } from "@/lib/context/chat-context";
import { Thread } from "@/lib/schemas/chat";
import { ChatModel, DEFAULT_CHAT_MODEL } from "@/lib/schemas/chat";
import { isClientPIIRedactionEnabled, redactUIMessages } from "@/lib/pii/redact";
import { ChatAIActionEnum } from "@/types/ai";

const logger = createLogger("components/introspection/IntrospectionChat");

export type IntrospectionChatProps = {
  chatData: { thread: Thread; messages: UIMessage[] };
  initialGuidedState: IntrospectionGuidedState;
  playEntryMorph?: boolean;
};

export function IntrospectionChat({
  chatData,
  initialGuidedState,
  playEntryMorph = false,
}: IntrospectionChatProps) {
  const { refreshSidebarChats } = useSharedChatContext();
  const selectedModelRef = useRef<ChatModel>(DEFAULT_CHAT_MODEL);
  const useWebSearchRef = useRef(false);
  const useMemoriesRef = useRef(false);
  const useSpeechFriendlyRef = useRef(false);
  const initialStartSent = useRef(false);
  const [chatError, setChatError] = useState<unknown>(undefined);
  const [aiAction, setAiAction] = useState<
    { action: ChatAIActionEnum; message?: string } | undefined
  >(undefined);

  const {
    guidedState,
    applyViewUpdate,
    canGoBack,
    canGoNext,
    goBack,
    goNext,
  } = useIntrospectionGuidedState(initialGuidedState);

  const stop = async () => {
    logger.log("IntrospectionChat", "stop noop");
  };

  const { messages, sendMessage, id, status, error, clearError } = useChat({
    id: chatData.thread.id,
    messages: chatData.messages,
    resume: true,
    transport: new DefaultChatTransport({
      api: "/api/chat",
      prepareSendMessagesRequest({ messages, id }) {
        const lastMessage = messages[messages.length - 1];
        const message = isClientPIIRedactionEnabled()
          ? redactUIMessages([lastMessage])[0]
          : lastMessage;

        return {
          body: {
            message,
            id,
            model: selectedModelRef.current,
            webSearch: useWebSearchRef.current,
            memory: useMemoriesRef.current,
            messageSearch: true,
            speechFriendly: useSpeechFriendlyRef.current,
            experience: "introspection",
            zeroDataRetention: getSettings().zeroDataRetention,
          },
        };
      },
    }),
    onData: (data) => {
      if (data.type === "data-introspection-view") {
        applyViewUpdate(data.data as IntrospectionGuidedState);
      } else if (data.type === "data-notification") {
        const payload = data.data as { message?: string };

        if (payload.message === "chat-title-generated") {
          refreshSidebarChats();
        }
      } else if (data.type === "data-aiAction") {
        const payload = data.data as { action: ChatAIActionEnum; message?: string };

        setAiAction({ action: payload.action, message: payload.message });
      }
    },
    onError: (err) => {
      setChatError(err);
      setAiAction({ action: ChatAIActionEnum.Errored });
      toast.error(getChatErrorMessage(err));
    },
    onFinish: () => {
      setAiAction(undefined);
    },
  });

  useEffect(() => {
    if (initialStartSent.current || messages.length > 0 || status !== "ready") return;

    initialStartSent.current = true;
    sendMessage({ text: "I'm ready to begin." });
  }, [messages.length, sendMessage, status]);

  const handleErrorCleared = useCallback(() => setChatError(undefined), []);

  return (
    <IntrospectionShell
      aiActionPayload={aiAction}
      canGoBack={canGoBack}
      canGoNext={canGoNext}
      chatId={id}
      composer={
        <CoreInput
          chatId={chatData.thread.id}
          clearError={clearError}
          error={error ?? chatError}
          hideWebMemorySpeechToggles
          modelRef={selectedModelRef}
          onErrorCleared={handleErrorCleared}
          sendMessage={sendMessage}
          status={status}
          stop={stop}
          useMemoriesRef={useMemoriesRef}
          useSpeechFriendlyRef={useSpeechFriendlyRef}
          useWebSearchRef={useWebSearchRef}
          variant="compact"
        />
      }
      guidedState={guidedState}
      messages={messages}
      playEntryMorph={playEntryMorph}
      onBack={goBack}
      onNext={goNext}
    />
  );
}
