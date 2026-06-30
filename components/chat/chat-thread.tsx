"use client";

import type { ExaSearchResultSource } from "@/lib/exa/types";

import { FC } from "react";
import { UIMessage } from "ai";

import { ChatEmptyStateGuide } from "@/components/onboarding/chat-empty-state-guide";
import { ConversationContent } from "../third-party/ai-elements/conversation";

import { ChatMessage } from "./chat-message";

import { ARCADIA_HELP_LATEST_ONLY, isArcadiaHelpMessage } from "@/lib/arcadia/help-response";
import { ChatAIActionEnum } from "@/types/ai";
import { cn } from "@/lib/utils";
import { getAssistantModelSummary } from "@/lib/chat/message-model";

/** Bottom padding to reserve when memory (ephemeral cards) can appear. Use same value always to avoid layout shift. */
export const MEMORY_PANEL_RESERVE_PADDING = "pb-40";

type ChatThreadProps = {
  messages: UIMessage[];
  /** Owning thread id; forwarded to messages for stateful gen-UI (Ergon kanban). */
  chatId?: string;
  variant?: "default" | "compact";
  className?: string;
  /** Extra class for the scrollable content (e.g. bottom padding when memory panel can overlay). */
  contentClassName?: string;
  aiActionPayload?: {
    action: ChatAIActionEnum;
    message?: string;
    sources?: ExaSearchResultSource[];
  };
  /** When set and there are no messages, replaces the default empty state (e.g. Noesis starters). */
  renderEmptyState?: () => React.ReactNode;
};

export const ChatThread: FC<ChatThreadProps> = ({
  messages,
  chatId,
  className,
  contentClassName,
  aiActionPayload,
  renderEmptyState,
}) => {
  const lastMessageIndex = messages.length - 1;
  const modelSummary = getAssistantModelSummary(messages);

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
      className={cn(
        "flex w-full flex-col px-4 pb-4 pt-8",
        renderEmptyState && messages.length === 0
          ? "min-h-0 flex-1 justify-center pt-4 pb-2"
          : "pb-12 pt-16",
        contentClassName,
        className
      )}
      scrollClassName="touch-manipulation w-full min-w-0 [scrollbar-gutter:stable]! overflow-x-hidden"
    >
      <div
        className={cn(
          "mx-auto flex w-full max-w-232 flex-col",
          renderEmptyState && messages.length === 0 ? "gap-0" : "gap-8"
        )}
      >
        {modelSummary.shouldUseThreadBadge && modelSummary.label ? (
          <div className="flex justify-end -mb-3">
            <span className="rounded-full border border-border/50 bg-background-tertiary/35 px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
              LLM · {modelSummary.label}
            </span>
          </div>
        ) : null}
        {messages.length === 0 ? (
          renderEmptyState ? (
            renderEmptyState()
          ) : (
            <ChatEmptyStateGuide />
          )
        ) : (
          messages.map((message, index) => {
            const isLatestArcadiaHelp =
              !ARCADIA_HELP_LATEST_ONLY ||
              (lastArcadiaHelpMessageId != null && message.id === lastArcadiaHelpMessageId);

            return (
              <ChatMessage
                key={message.id}
                aiActionPayload={index === lastMessageIndex ? aiActionPayload : undefined}
                chatId={chatId}
                isLatestArcadiaHelp={
                  isArcadiaHelpMessage(message) ? isLatestArcadiaHelp : undefined
                }
                message={message}
                showModelBadge={!modelSummary.shouldUseThreadBadge}
              />
            );
          })
        )}
      </div>
    </ConversationContent>
  );
};
