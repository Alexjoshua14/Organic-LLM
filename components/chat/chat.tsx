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
import { useArchetypeContext } from "@/lib/context/archetype-context";

const logger = createLogger("components/chat/chat");

export type ChatProps = {
  chatData: { thread: Thread; messages: UIMessage[] } | null;
  initialMessage?: string;
  persona?: "prometheus" | "spark" | "aion" | "remy";
  endpoint?: string;
};

export const Chat: React.FC<ChatProps> = ({
  chatData,
  endpoint,
  persona,
  initialMessage,
}) => {

  const selectedModelRef = useRef<ChatModel>(DEFAULT_CHAT_MODEL);
  const useWebSearchRef = useRef<boolean>(false);
  const useMemoriesRef = useRef<boolean>(false);
  const usePersistedSchemas = useRef<boolean>(persona === 'aion');
  const initialMessageSent = useRef<boolean>(false);

  const { messages, sendMessage, id, stop, status, setMessages, addToolOutput } = useChat({
    id: chatData?.thread.id ?? "",
    messages: chatData?.messages ?? [],
    transport: new DefaultChatTransport({
      api: persona === 'aion' ? '/api/ai/aion' : persona === 'remy' ? '/api/ai/remy' : endpoint ?? `/api/chat/${persona ?? ""}`,
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
      logger.log("chat", `TOOL_CALL ${JSON.stringify(toolCall, null, 2)}`);


      // If expecting tool call on UI side add output here

    },
    onData: (data) => {
      /** Side channel for UI events */
      logger.log("chat", JSON.stringify(data, null, 2))
      if (data.type === "data-notification") {
        logger.log("chat", `DATA_NOTIFICATION ${JSON.stringify(data.data, null, 2)}`);
      }
    }
  });

  // Send initial message if provided
  useEffect(() => {
    if (initialMessage && !initialMessageSent.current && messages.length === 0 && status === "ready") {
      initialMessageSent.current = true;
      sendMessage({ text: initialMessage });
    }
  }, [initialMessage, messages.length, status, sendMessage]);

  const handleStop = useCallback(async () => {
    // Remove the latest user message and partially completed AI message from messages
    // Remove the latest user message and any partially completed AI response
    stop();

    /** The following commented out section would revert messages, fully aborting current generation */
    // setMessages((prevMessages) => {
    //   // Find the last user message
    //   const lastUserIndex = [...prevMessages]
    //     .reverse()
    //     .findIndex((msg) => msg.role === "user");
    //   if (lastUserIndex === -1) {
    //     return prevMessages;
    //   }
    //   // Calculate the index in the original array
    //   const lastUserMsgIdx = prevMessages.length - 1 - lastUserIndex;

    //   // Remove the last user message and any AI message immediately after it (if exists)
    //   let newMessages = prevMessages.slice(0, lastUserMsgIdx);
    //   // Check if there's an AI message after the last user
    //   if (
    //     prevMessages[lastUserMsgIdx + 1] &&
    //     prevMessages[lastUserMsgIdx + 1].role === "assistant"
    //   ) {
    //     // Remove the AI message as well
    //     newMessages = prevMessages.slice(0, lastUserMsgIdx);
    //   } else {
    //     // If not, just slice off including the user message
    //     newMessages = prevMessages.slice(0, lastUserMsgIdx);
    //   }
    //   return newMessages;
    // });
  }, [messages])

  return (
    <div
      className={[
        "w-full",
        "max-w-232",
        "h-full",
        "max-h-[calc(100dvh-2rem)]",
        "flex",
        "flex-col",
        "overflow-hidden",
      ].join(" ")}
    >
      <Conversation
        className={[
          "flex-1",
          "min-h-0",
          "w-full",
          "relative",
          "flex",
          "flex-col",
          "items-center",
          "overflow-x-hidden",
          "overscroll-x-none",
        ].join(" ")}
      >
        <ChatThread messages={messages} />
        <ConversationScrollButton className="bottom-14" />
      </Conversation>
      <div className="shrink-0 px-4 sm:px-7 pb-1 md:pb-4 w-full -mt-10">
        <NewChatInput
          modelRef={selectedModelRef}
          useWebSearchRef={useWebSearchRef}
          useMemoriesRef={useMemoriesRef}
          sendMessage={sendMessage}
          stop={handleStop}
          status={status}
        />
      </div>
    </div>
  );
};
