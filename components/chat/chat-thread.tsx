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
    // <StickToBottom.Content
    //   className={cn("w-full mx-auto flex flex-col gap-2 pr-3 pt-20", className)}
    //   style={{ paddingBottom: '3rem' }}
    // >
    <ConversationContent className="px-4 flex flex-col">
      {messages.map((message) => {
        return <ChatMessage key={message.id} message={message} />;
      })}
    </ConversationContent>
  );
};
