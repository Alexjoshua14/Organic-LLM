"use client";

import { UIMessage, useChat } from "@ai-sdk/react";
import { StickToBottom } from "use-stick-to-bottom";
import { DefaultChatTransport } from "ai";
import { useEffect, useState } from "react";

import { ChatInput } from "./chat-input";
import { ChatThread } from "./chat-thread";
import { ChatScrollButton } from "./chat-scroll-button";

import { Thread } from "@/lib/schemas/chat";
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

export const Chat: React.FC<ChatProps> = ({
  chatData,
  initialMessage,
  endpoint,
  persona,
}) => {
  const [updatingSummary, setUpdatingSummary] = useState(false);

  const { setChatId } = useSharedChatContext();

  useEffect(() => {
    setChatId(chatData?.thread.id ?? "");

    return () => {
      setChatId("");
    };
  }, [chatData]);

  const { messages, sendMessage, id } = useChat({
    id: chatData?.thread.id ?? "",
    messages: chatData?.messages ?? [],
    transport: new DefaultChatTransport({
      api: endpoint ?? `/api/chat/${persona ?? ""}`,
      prepareSendMessagesRequest({ messages, id }) {
        return { body: { message: messages[messages.length - 1], id } };
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

  // useEffect(() => {
  //   if (initialMessage && messages.length === 0) {
  //     logger.log("Chat", `Sending initial message: ${initialMessage}`);
  //     sendMessage({
  //       text: initialMessage,
  //     });
  //   } else {
  //     logger.log("Chat", `Didn't send initial message.. intialMessage: ${initialMessage}, messages.length: ${messages.length}`)
  //   }
  // }, []);

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

  return (
    <StickToBottom
      className="h-full w-full relative mx-2 flex flex-col items-center"
      initial="instant"
      resize="smooth"
    >
      <ChatThread messages={messages} />
      <ChatScrollButton />
      <ChatInput id={id} sendMessage={sendMessage} />
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
