"use client";

import { UIMessage, useChat } from "@ai-sdk/react";
import { StickToBottom } from "use-stick-to-bottom";
import { DefaultChatTransport } from "ai";
import { useCallback, useEffect, useRef } from "react";

import { ChatInput } from "./chat-input";
import { ChatThread } from "./chat-thread";
import { ChatScrollButton } from "./chat-scroll-button";

import { Thread } from "@/lib/schemas/chat";
import { createLogger } from "@/lib/logger";
import { useSharedChatContext } from "@/lib/context/chat-context";
import { ChatModel, DEFAULT_CHAT_MODEL } from "@/lib/schemas/chat";
import { NewChatInput } from "./new-chat-input";

const logger = createLogger("components/chat/chat");

type ChatProps = {
  chatData: { thread: Thread; messages: UIMessage[] } | null;
  initialMessage?: string;
  persona?: "prometheus" | "spark";
  endpoint?: string;
};

export const Chat: React.FC<ChatProps> = ({
  chatData,
  endpoint,
  persona,
}) => {

  const selectedModelRef = useRef<ChatModel>(DEFAULT_CHAT_MODEL);
  const useWebSearchRef = useRef<boolean>(false);
  const useMemoriesRef = useRef<boolean>(true);

  const { messages, sendMessage, id, stop, status, setMessages } = useChat({
    id: chatData?.thread.id ?? "",
    messages: chatData?.messages ?? [],
    transport: new DefaultChatTransport({
      api: endpoint ?? `/api/chat/${persona ?? ""}`,
      prepareSendMessagesRequest({ messages, id }) {
        const req = {
          body: {
            message: messages[messages.length - 1],
            id,
            model: selectedModelRef.current,
            webSearch: useWebSearchRef.current,
            memory: useMemoriesRef.current,
          },
        }
        console.log(`Request being sent: ${JSON.stringify(req, null, 2)}`)
        return req;
      },
    }),
    onToolCall({ toolCall }) {
      console.log("TOOL_CALL", toolCall);
    },
  });

  const handleStop = useCallback(async () => {
    // Remove the latest user message and partially completed AI message from messages
    // Remove the latest user message and any partially completed AI response
    stop();
    setMessages((prevMessages) => {
      // Find the last user message
      const lastUserIndex = [...prevMessages]
        .reverse()
        .findIndex((msg) => msg.role === "user");
      if (lastUserIndex === -1) {
        return prevMessages;
      }
      // Calculate the index in the original array
      const lastUserMsgIdx = prevMessages.length - 1 - lastUserIndex;

      // Remove the last user message and any AI message immediately after it (if exists)
      let newMessages = prevMessages.slice(0, lastUserMsgIdx);
      // Check if there's an AI message after the last user
      if (
        prevMessages[lastUserMsgIdx + 1] &&
        prevMessages[lastUserMsgIdx + 1].role === "assistant"
      ) {
        // Remove the AI message as well
        newMessages = prevMessages.slice(0, lastUserMsgIdx);
      } else {
        // If not, just slice off including the user message
        newMessages = prevMessages.slice(0, lastUserMsgIdx);
      }
      return newMessages;
    });
  }, [messages])

  return (
    <StickToBottom
      className={
        [
          "h-full",
          "w-full",
          "max-w-[calc(100dvw-2rem)]",
          "md:max-w-[calc(100dvw-18rem)]",
          "lg:max-w-4xl",
          "relative",
          "mx-2",
          "flex",
          "flex-col",
          "items-center",
        ].join(" ")
      }
      style={{ paddingBottom: "7rem" }}
      initial="instant"
      resize="smooth"
    >
      <ChatThread messages={messages} />
      <ChatScrollButton />
      <NewChatInput
        modelRef={selectedModelRef}
        useWebSearchRef={useWebSearchRef}
        useMemoriesRef={useMemoriesRef}
        sendMessage={sendMessage}
        stop={handleStop}
        status={status}
        className="absolute bottom-4"
      />
    </StickToBottom>
  );
};
