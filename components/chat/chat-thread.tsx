"use client";

import type { ExaSearchResultSource } from "@/lib/exa/types";

import { FC } from "react";
import { UIMessage } from "ai";
import { MessageSquare } from "lucide-react";

import {
  ConversationContent,
  ConversationEmptyState,
} from "../third-party/ai-elements/conversation";

import { ChatMessage } from "./chat-message";
import {
  ARCADIA_HELP_LATEST_ONLY,
  isArcadiaHelpMessage,
} from "@/lib/arcadia/help-response";

import { ChatAIActionEnum } from "@/types/ai";
import { cn } from "@/lib/utils";

/** Bottom padding to reserve when memory (ephemeral cards) can appear. Use same value always to avoid layout shift. */
export const MEMORY_PANEL_RESERVE_PADDING = "pb-40";

type ChatThreadProps = {
  messages: UIMessage[];
  variant?: "default" | "compact";
  className?: string;
  /** Extra class for the scrollable content (e.g. bottom padding when memory panel can overlay). */
  contentClassName?: string;
  aiActionPayload?: {
    action: ChatAIActionEnum;
    message?: string;
    sources?: ExaSearchResultSource[];
  };
};

export const ChatThread: FC<ChatThreadProps> = ({
  messages,
  variant = "default",
  className,
  contentClassName,
  aiActionPayload,
}) => {
  const lastMessageIndex = messages.length - 1;

  const lastArcadiaHelpMessageId =
    ARCADIA_HELP_LATEST_ONLY &&
    (() => {
      for (let i = messages.length - 1; i >= 0; i--) {
        if (isArcadiaHelpMessage(messages[i])) return messages[i].id ?? null;
      }
      return null;
    })();

  return (
    <ConversationContent
      className={cn("w-full px-4 pt-16 pb-12 flex flex-col", contentClassName)}
      scrollClassName="touch-manipulation w-full min-w-0 [scrollbar-gutter:stable]! overflow-x-hidden"
    >
      <div className="max-w-232 mx-auto w-full flex flex-col gap-8">
        {messages.length === 0 ? (
          <ConversationEmptyState
            description="Type a message below to begin chatting"
            icon={<MessageSquare className="size-12" />}
            title="Start a conversation"
          />
        ) : (
          messages.map((message, index) => {
            const isLatestArcadiaHelp =
              !ARCADIA_HELP_LATEST_ONLY ||
              (lastArcadiaHelpMessageId != null && message.id === lastArcadiaHelpMessageId);
            return (
              <ChatMessage
                key={message.id}
                aiActionPayload={index === lastMessageIndex ? aiActionPayload : undefined}
                isLatestArcadiaHelp={isArcadiaHelpMessage(message) ? isLatestArcadiaHelp : undefined}
                message={message}
              />
            );
          })
        )}
      </div>
    </ConversationContent>
  );
};
