"use client";

import { UIMessage, useChat } from "@ai-sdk/react";
import { StickToBottom } from "use-stick-to-bottom";
import { DefaultChatTransport } from "ai";
import { useEffect, useRef } from "react";

import { ChatInput } from "./chat-input";
import { ChatThread } from "./chat-thread";
import { ChatScrollButton } from "./chat-scroll-button";

import { Thread } from "@/lib/schemas/chat";
import { updateChatSummary } from "@/lib/llm/chat-helpers";
import { createLogger } from "@/lib/logger";
import { useSharedChatContext } from "@/lib/context/chat-context";
import { ChatModelType, DEFAULT_CHAT_MODEL } from "@/lib/schemas/chat";
import { getNMessages } from "@/data/supabase/chat";

const logger = createLogger("components/chat/chat");

type ChatProps = {
  chatData: { thread: Thread; messages: UIMessage[] } | null;
  initialMessage?: string;
  persona?: "prometheus" | "spark";
  endpoint?: string;
};

export const Chat: React.FC<ChatProps> = ({
  chatData,
  initialMessage,
  endpoint,
  persona,
}) => {

  const { setChatId } = useSharedChatContext();
  const selectedModelRef = useRef<ChatModelType>(DEFAULT_CHAT_MODEL);

  useEffect(() => {
    setChatId(chatData?.thread.id ?? "");

    return () => {
      setChatId("");
    };
  }, [chatData]);

  const { messages, sendMessage, id, stop, status } = useChat({
    id: chatData?.thread.id ?? "",
    messages: chatData?.messages ?? [],
    transport: new DefaultChatTransport({
      api: endpoint ?? `/api/chat/${persona ?? ""}`,
      prepareSendMessagesRequest({ messages, id }) {
        return {
          body: {
            message: messages[messages.length - 1],
            id,
            model: selectedModelRef.current,
          },
        };
      },
    }),
    onToolCall({ toolCall }) {
      console.log("TOOL_CALL", toolCall);
    },
  });

  return (
    <StickToBottom
      className="h-full w-full relative mx-2 flex flex-col items-center"
      initial="instant"
      resize="smooth"
    >
      <ChatThread messages={messages} />
      <ChatScrollButton />
      <ChatInput
        id={id}
        sendMessage={sendMessage}
        selectedModelRef={selectedModelRef}
        stop={stop}
        status={status}
      />
    </StickToBottom>
  );
};
