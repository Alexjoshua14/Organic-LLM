"use client";

import { UIMessage, useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useCallback, useEffect, useRef } from "react";

import { ChatThread } from "./chat-thread";

import { Thread } from "@/lib/schemas/chat";
import { createLogger } from "@/lib/logger";
import { useSharedChatContext } from "@/lib/context/chat-context";
import { ChatModel, DEFAULT_CHAT_MODEL } from "@/lib/schemas/chat";
import { NewChatInput } from "./new-chat-input";
import { Conversation, ConversationScrollButton } from "../third-party/ai-elements/conversation";

const logger = createLogger("components/chat/chat");

type ChatProps = {
  chatData: { thread: Thread; messages: UIMessage[] } | null;
  initialMessage?: string;
  persona?: "prometheus" | "spark" | "aion";
  endpoint?: string;
};

export const Chat: React.FC<ChatProps> = ({
  chatData,
  endpoint,
  persona,
}) => {

  const selectedModelRef = useRef<ChatModel>(DEFAULT_CHAT_MODEL);
  const useWebSearchRef = useRef<boolean>(false);
  const useMemoriesRef = useRef<boolean>(false);
  const usePersistedSchemas = useRef<boolean>(persona === 'aion');

  const { messages, sendMessage, id, stop, status, setMessages } = useChat({
    id: chatData?.thread.id ?? "",
    messages: chatData?.messages ?? [],
    transport: new DefaultChatTransport({
      api: persona === 'aion' ? '/api/ai/aion' : endpoint ?? `/api/chat/${persona ?? ""}`,
      prepareSendMessagesRequest({ messages, id }) {
        const req = {
          body: {
            message: messages[messages.length - 1],
            id,
            model: selectedModelRef.current,
            webSearch: useWebSearchRef.current,
            memory: useMemoriesRef.current,
            // Only include persistedSchemas in payload if true
            ...(usePersistedSchemas.current ? { persistedSchemas: true } : {}),
          },
        }
        logger.log("chat", `Request being sent: ${JSON.stringify(req, null, 2)}`)
        return req;
      },
    }),
    onToolCall({ toolCall }) {
      logger.log("chat", "TOOL_CALL", toolCall);
    },
    onData: (data) => {
      logger.log("chat", JSON.stringify(data, null, 2))
    }
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
    <div
      className={[
        "w-full",
        "max-w-232",
        "h-full",
        "max-h-[calc(100dvh-2rem)]",
        "flex",
        "items-center",
        "justify-center",
        "overflow-hidden",
        "relative",
        "min-w-fit"
      ].join(" ")}
    >
      <Conversation
        className={
          [
            "h-full",
            "w-full",
            "relative",
            "flex",
            "flex-col",
            "items-center",
          ].join(" ")
        }
        style={{ paddingBottom: "8rem" }}
      >
        <ChatThread messages={messages} />
        <ConversationScrollButton />
      </Conversation>
      <NewChatInput
        modelRef={selectedModelRef}
        useWebSearchRef={useWebSearchRef}
        useMemoriesRef={useMemoriesRef}
        sendMessage={sendMessage}
        stop={handleStop}
        status={status}
        className="absolute bottom-1 md:bottom-4 px-8 w-full"
      />
    </div>
  );
};
