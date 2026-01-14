"use client";

import { FC } from "react";
import { UIMessage } from "ai";
import { MessageSquare } from "lucide-react";

import { ChatMessage } from "./chat-message";
import { ConversationContent, ConversationEmptyState } from "../third-party/ai-elements/conversation";


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
      {messages.length === 0 ? (
        <ConversationEmptyState
          icon={<MessageSquare className="size-12" />}
          title="Start a conversation"
          description="Type a message below to begin chatting"
        />
      ) : (
        messages.map((message) => (
          <ChatMessage key={message.id} message={message} />
        ))
      )}
    </ConversationContent>
  );
};
