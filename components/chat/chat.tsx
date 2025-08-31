"use client";

import { UIMessage, useChat } from "@ai-sdk/react";
import { StickToBottom } from "use-stick-to-bottom";
import { DefaultChatTransport } from "ai";
import { useEffect } from "react";

import { ChatInput } from "./chat-input";
import { ChatThread } from "./chat-thread";
import { ChatScrollButton } from "./chat-scroll-button";

import { Thread } from "@/lib/schemas/chat";
import { ensureChatHasTitle } from "@/lib/llm/chat-helpers";

type ChatProps = {
  chatData: { thread: Thread; messages: UIMessage[] } | null;
};

export const Chat: React.FC<ChatProps> = ({ chatData }) => {
  const { messages, sendMessage, id } = useChat({
    id: chatData?.thread.id ?? "",
    messages: chatData?.messages ?? [],
    transport: new DefaultChatTransport({
      api: "/api/chat",
      prepareSendMessagesRequest({ messages, id }) {
        return { body: { message: messages[messages.length - 1], id } };
      },
    }),
  });

  useEffect(() => {
    // Simply ensure chat has title when the user leaves
    return () => {
      if (chatData?.thread.id && messages.length > 3) {
        ensureChatHasTitle(chatData.thread.id);
      }
    };
  }, [chatData, messages]);

  return (
    <StickToBottom
      className="h-full w-full relative mx-2"
      initial="instant"
      resize="smooth"
    >
      {/*<div className="absolute top-0 w-full inline-block text-center justify-center p-4 bg-white/5 backdrop-blur-xl shadow">
      <span className={title()}>Welcome Chat ;)</span>
      <span className={subtitle()}>Chat ID: {chatId}</span>
    </div>*/}
      <ChatThread messages={messages} />
      <ChatScrollButton />
      <ChatInput id={id} sendMessage={sendMessage} />
    </StickToBottom>
  );
};
