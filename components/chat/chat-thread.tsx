"use client";

import { FC } from "react";
import { UIMessage } from "ai";
import { MessageSquare } from "lucide-react";

import { ChatMessage } from "./chat-message";
import { ChatAIActionEnum } from "@/types/ai";
import type { ExaSearchResultSource } from "@/lib/exa/types";
import { ConversationContent, ConversationEmptyState } from "../third-party/ai-elements/conversation";

type ChatThreadProps = {
  messages: UIMessage[];
  variant?: "default" | "compact";
  className?: string;
  aiActionPayload?: { action: ChatAIActionEnum; message?: string; sources?: ExaSearchResultSource[] };
};

export const ChatThread: FC<ChatThreadProps> = ({
  messages,
  variant = "default",
  className,
  aiActionPayload,
}) => {
  const lastMessageIndex = messages.length - 1;
  return (
    <ConversationContent className="w-full px-4 pt-16 pb-12 flex flex-col">
      {messages.length === 0 ? (
        <ConversationEmptyState
          icon={<MessageSquare className="size-12" />}
          title="Start a conversation"
          description="Type a message below to begin chatting"
        />
      ) : (
        messages.map((message, index) => (
          <ChatMessage key={message.id} message={message} aiActionPayload={index === lastMessageIndex ? aiActionPayload : undefined} />
        ))
      )}
    </ConversationContent>
  );
};
