"use client";

import { FC } from "react";
import { UIMessage } from "ai";
import { StickToBottom } from "use-stick-to-bottom";
import { cn } from "@/lib/utils";

import { ChatMessage } from "./chat-message";
import { ConversationContent } from "../third-party/ai-elements/conversation";

type ChatThreadProps = {
  messages: UIMessage[];
  variant?: "default" | "compact";
  className?: string;
};

export const ChatThread: FC<ChatThreadProps> = ({
  messages,
  variant = "default",
  className,
}) => {
  return (
    <ConversationContent className="w-full px-4 pt-16 pb-12 flex flex-col">
      {messages.map((message) => {
        return <ChatMessage key={message.id} message={message} />;
      })}
    </ConversationContent>
  );
};
