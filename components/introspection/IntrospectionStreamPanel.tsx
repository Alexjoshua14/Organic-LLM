"use client";

import type { UIMessage } from "ai";

import { ChevronDown, ChevronUp } from "lucide-react";
import { useMemo, useState } from "react";

import { ChatMessage } from "@/components/chat/chat-message";
import { ChatReasoning, ChatThinking } from "@/components/chat/chat-loading";
import { glass } from "@/components/design-system/primitives";
import { Button } from "@/components/third-party/ui/button";
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
};

export function IntrospectionStreamPanel({
  messages,
  chatId,
  aiActionPayload,
  className,
}: IntrospectionStreamPanelProps) {
  const [expanded, setExpanded] = useState(true);

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
    <div className={cn(glass(), "shrink-0 rounded-xl border border-border/50", className)}>
      <div className="flex items-center justify-between gap-2 border-b border-border/40 px-3 py-2">
        <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
          Latest response
        </p>
        <Button
          aria-expanded={expanded}
          size="icon"
          type="button"
          variant="ghost"
          onClick={() => setExpanded((v) => !v)}
        >
          {expanded ? <ChevronDown className="size-4" /> : <ChevronUp className="size-4" />}
        </Button>
      </div>
      {expanded ? (
        <div className="max-h-48 overflow-y-auto px-3 py-3 space-y-3">
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
        </div>
      ) : null}
    </div>
  );
}
