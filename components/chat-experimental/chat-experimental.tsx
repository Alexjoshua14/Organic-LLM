"use client";

import { UIMessage, useChat } from "@ai-sdk/react";
import { StickToBottom } from "use-stick-to-bottom";
import { DefaultChatTransport } from "ai";
import { useCallback, useEffect, useRef, useState } from "react";

import { ChatThreadExperimental } from "./chat-thread-experimental";

import { ChatInput } from "@/components/chat/chat-input";
import { ChatScrollButton } from "@/components/chat/chat-scroll-button";
import {
  isClientPIIRedactionEnabled,
  redactUIMessages,
} from "@/lib/pii/redact";
import { ChatModel, DEFAULT_CHAT_MODEL, Thread } from "@/lib/schemas/chat";
import { updateChatSummary } from "@/lib/llm/chat-helpers";
import { createLogger } from "@/lib/logger";
import { useSharedChatContext } from "@/lib/context/chat-context";

const logger = createLogger("components/chat/chat");

type ChatProps = {
  chatData: { thread: Thread; messages: UIMessage[] } | null;
  initialMessage?: string;
  persona?: "prometheus" | "spark";
  endpoint?: string;
};

export const ChatExperimental: React.FC<ChatProps> = ({
  chatData,
  initialMessage,
  endpoint,
  persona,
}) => {
  const [updatingSummary, setUpdatingSummary] = useState(false);

  const { setChatId } = useSharedChatContext();
  const selectedModelRef = useRef<ChatModel>(DEFAULT_CHAT_MODEL);

  useEffect(() => {
    setChatId(chatData?.thread.id ?? "");

    return () => {
      setChatId("");
    };
  }, [chatData]);

  const { messages, sendMessage, id, stop, setMessages, status } = useChat({
    id: chatData?.thread.id ?? "",
    messages: chatData?.messages ?? [],
    transport: new DefaultChatTransport({
      api: endpoint ?? `/api/chat/${persona ?? ""}`,
      prepareSendMessagesRequest({ messages, id }) {
        const lastMessage = messages?.length ? messages[messages.length - 1] : undefined;
        const message = lastMessage && isClientPIIRedactionEnabled()
          ? redactUIMessages([lastMessage])[0]
          : lastMessage;
        return {
          body: {
            message,
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

  // useEffect(() => {
  //   // Simply ensure chat has title when the user leaves
  //   return () => {
  //     if (chatData?.thread.title === null && messages.length > 3) {
  //       ensureChatHasTitle(chatData.thread.id);
  //     }
  //   };
  // }, [chatData, messages]);

  useEffect(() => {
    if (initialMessage && messages.length === 0) {
      sendMessage({
        text: initialMessage,
      });
    }
  }, []);

  const handleUpdateSummary = async () => {
    if (!chatData?.thread.id) {
      logger.error("handleUpdateSummary", "Chat ID is missing");

      return;
    }
    if (updatingSummary) {
      logger.error("handleUpdateSummary", "Already updating summary");

      return;
    }

    setUpdatingSummary(true);
    try {
      const { data, error } = await updateChatSummary(chatData.thread.id);

      if (error) {
        logger.error(
          "handleUpdateSummary",
          `Failed to update chat summary: ${error}`,
        );
      } else {
        logger.log("handleUpdateSummary", `Updated chat summary: ${data}`);
      }
    } catch (error) {
      logger.error(
        "handleUpdateSummary",
        `Failed to update chat summary: ${error}`,
      );
    } finally {
      setUpdatingSummary(false);
    }
  };

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
      className="h-full w-full relative mx-2 flex flex-col items-center"
      initial="instant"
      resize="smooth"
    >
      <ChatThreadExperimental messages={messages} />
      <ChatScrollButton />
      <ChatInput id={id} sendMessage={sendMessage} selectedModelRef={selectedModelRef} stop={handleStop} status={status} />
      {/* <div className="absolute top-20 right-0 z-40">
        <button
          className="px-4 py-2 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-400 text-white rounded-md transition-colors"
          disabled={updatingSummary}
          onClick={handleUpdateSummary}
        >
          {updatingSummary ? "Updating..." : "Update Summary"}
        </button>
      </div> */}
    </StickToBottom>
  );
};
