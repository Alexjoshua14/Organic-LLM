"use client";

import type { UIMessage } from "ai";

import { useMemo } from "react";

import { ChatMessage } from "@/components/chat/chat-message";
import { ChatReasoning, ChatThinking } from "@/components/chat/chat-loading";
import {
  Conversation,
  ConversationContent,
} from "@/components/third-party/ai-elements/conversation";
import { cn } from "@/lib/utils";
import { ChatAIActionEnum } from "@/types/ai";

type IntrospectionStreamPanelProps = {
  messages: UIMessage[];
  chatId: string;
  aiActionPayload?: {
    action: ChatAIActionEnum;
    message?: string;
  };
  className?: string;
  /** When true, fills the sidebar column instead of a compact strip. */
  sidebar?: boolean;
};

export function IntrospectionStreamPanel({
  messages,
  chatId,
  aiActionPayload,
  className,
  sidebar = false,
}: IntrospectionStreamPanelProps) {
  const latestTurn = useMemo(() => {
    const lastAssistantIndex = [...messages]
      .map((m, i) => ({ m, i }))
      .reverse()
      .find(({ m }) => m.role === "assistant")?.i;

    if (lastAssistantIndex == null) return { user: null as UIMessage | null, assistant: null };

    const assistant = messages[lastAssistantIndex];
    let user: UIMessage | null = null;

    for (let i = lastAssistantIndex - 1; i >= 0; i -= 1) {
      if (messages[i].role === "user") {
        user = messages[i];
        break;
      }
    }

    return { user, assistant };
  }, [messages]);

  const isStreaming =
    aiActionPayload?.action === ChatAIActionEnum.Processing ||
    aiActionPayload?.action === ChatAIActionEnum.Reasoning ||
    aiActionPayload?.action === ChatAIActionEnum.Typing;

  return (
    <div
      className={cn(
        "flex min-h-0 flex-col",
        sidebar ? "flex-1" : "shrink-0 rounded-xl border border-border/50",
        className
      )}
    >
      <Conversation
        className={cn(
          "relative flex min-h-0 flex-col overflow-hidden",
          sidebar ? "flex-1" : "max-h-48"
        )}
      >
        <ConversationContent className="w-full flex-1 space-y-3 px-3 py-3">
          {latestTurn.user ? <ChatMessage chatId={chatId} message={latestTurn.user} /> : null}
          {latestTurn.assistant ? (
            <ChatMessage
              aiActionPayload={aiActionPayload}
              chatId={chatId}
              isLastMessage
              message={latestTurn.assistant}
            />
          ) : isStreaming ? (
            aiActionPayload?.action === ChatAIActionEnum.Reasoning ? (
              <ChatReasoning text={aiActionPayload.message} />
            ) : (
              <ChatThinking text={aiActionPayload?.message} />
            )
          ) : (
            <p className="text-muted-foreground text-sm">Waiting for your guide…</p>
          )}
        </ConversationContent>
      </Conversation>
    </div>
  );
}
