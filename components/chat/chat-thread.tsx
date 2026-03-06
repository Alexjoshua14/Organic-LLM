"use client";

import { FC } from "react";
import { UIMessage } from "ai";
import { MessageSquare } from "lucide-react";

import { ChatMessage } from "./chat-message";
import { ChatAIActionEnum } from "@/types/ai";
import type { ExaSearchResultSource } from "@/lib/exa/types";
import { ConversationContent, ConversationEmptyState } from "../third-party/ai-elements/conversation";
import { cn } from "@/lib/utils";

/** Bottom padding to reserve when memory (ephemeral cards) can appear. Use same value always to avoid layout shift. */
export const MEMORY_PANEL_RESERVE_PADDING = "pb-40";

type ChatThreadProps = {
  messages: UIMessage[];
  variant?: "default" | "compact";
  className?: string;
  /** Extra class for the scrollable content (e.g. bottom padding when memory panel can overlay). */
  contentClassName?: string;
  aiActionPayload?: { action: ChatAIActionEnum; message?: string; sources?: ExaSearchResultSource[] };
};

export const ChatThread: FC<ChatThreadProps> = ({
  messages,
  variant = "default",
  className,
  contentClassName,
  aiActionPayload,
}) => {
  const lastMessageIndex = messages.length - 1;
  return (
    <ConversationContent
      className={cn("w-full px-4 pt-16 pb-12 flex flex-col", contentClassName)}
      scrollClassName="touch-manipulation"
    >
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
