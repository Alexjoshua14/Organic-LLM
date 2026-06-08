"use client";

import type { UIMessage } from "ai";
import type { ShowcaseTrace } from "@/lib/showcase/showcase-trace";

import { useMemo } from "react";

import { ChatMessage } from "@/components/chat/chat-message";
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/third-party/ai-elements/conversation";
import {
  SimulatedStreamReplayButton,
  useSimulatedStream,
} from "@/components/showcase/SimulatedStream";
import {
  buildAnatomyAssistantMessage,
  buildAnatomyUserMessage,
} from "@/lib/showcase/build-anatomy-messages";
import { glass } from "@/components/design-system/primitives";
import { cn } from "@/lib/utils";

type ConversationRailProps = {
  trace: ShowcaseTrace;
  className?: string;
};

export function ConversationRail({ trace, className }: ConversationRailProps) {
  const fullText = trace.finalResponse.markdown;
  const { displayedText, complete, replay } = useSimulatedStream(fullText, {
    tickMs: 20,
    chunkChars: 3,
  });

  const messages: UIMessage[] = useMemo(
    () => [
      buildAnatomyUserMessage(trace.prompt),
      buildAnatomyAssistantMessage(trace, displayedText, complete),
    ],
    [complete, displayedText, trace]
  );

  return (
    <div
      className={cn(
        "flex h-[min(520px,58dvh)] min-h-0 flex-col overflow-hidden rounded-2xl border border-border/70 shadow-sm",
        glass({ border: "none", opaque: true }),
        "lg:sticky lg:top-20 lg:h-auto lg:max-h-[calc(100dvh-8rem)]",
        className
      )}
    >
      <div className="flex shrink-0 items-center justify-between border-b border-border/50 px-3 py-2">
        <span className="text-xs font-medium text-muted-foreground">Conversation</span>
        <SimulatedStreamReplayButton onReplay={replay} />
      </div>
      <Conversation className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
        <ConversationContent className="w-full flex-1 overflow-y-auto px-3 pt-4 pb-6 sm:px-4">
          <div className="mx-auto flex w-full max-w-232 flex-col gap-6">
            {messages.map((m) => (
              <ChatMessage key={m.id} message={m} />
            ))}
          </div>
        </ConversationContent>
        <ConversationScrollButton className="bottom-3" />
      </Conversation>
    </div>
  );
}
