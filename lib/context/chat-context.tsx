"use client";

import React, { createContext, useContext, ReactNode, useState } from "react";
import { Chat } from "@ai-sdk/react";
import { DefaultChatTransport, UIMessage } from "ai";

interface ChatContextValue {
  chat: Chat<UIMessage>;
  clearChat: () => void;
  setChatId: (chatId: string) => void;
  chatId: string;
}

const ChatContext = createContext<ChatContextValue | undefined>(undefined);

function createChat() {
  return new Chat<UIMessage>({
    transport: new DefaultChatTransport({
      api: "/api/chat",
    }),
  });
}

export function ChatProvider({ children }: { children: ReactNode }) {
  const [chat, setChat] = useState(() => createChat());
  const [chatId, setChatId] = useState<string>("");

  const clearChat = () => {
    setChat(createChat());
  };

  return (
    <ChatContext.Provider
      value={{
        chat,
        clearChat,
        setChatId,
        chatId,
      }}
    >
      {children}
    </ChatContext.Provider>
  );
}

export function useSharedChatContext() {
  const context = useContext(ChatContext);

  if (!context) {
    throw new Error("useSharedChatContext must be used within a ChatProvider");
  }

  return context;
}
