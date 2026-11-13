"use client";

import type { RealtimeTranscriptEntry } from "@/hooks/use-realtime-voice";

import { MessageSquareText } from "lucide-react";

import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
} from "@/components/third-party/ai-elements/conversation";
import { cn } from "@/lib/utils";

/**
 * The call, as a readable conversation. Uses the shared `Conversation` so following, reduced
 * motion and "Scroll to latest message" behave exactly like chat
 * (`docs/design/conversation-scrolling.md`).
 */
export function SpeakTranscript({
  entries,
  className,
}: {
  entries: RealtimeTranscriptEntry[];
  className?: string;
}) {
  const turns = entries.filter((entry) => entry.text.trim().length > 0);

  return (
    <Conversation aria-label="Call transcript" className={cn("min-h-0", className)}>
      <ConversationContent className="gap-stack-md p-inset-md">
        {turns.length === 0 ? (
          <ConversationEmptyState
            description="What you and Organic say appears here as you talk."
            icon={<MessageSquareText aria-hidden className="size-5" />}
            title="No words yet"
          />
        ) : (
          turns.map((entry) => <TranscriptTurn key={entry.id} entry={entry} />)
        )}
      </ConversationContent>
      <ConversationScrollButton className="bottom-3" />
    </Conversation>
  );
}

function TranscriptTurn({ entry }: { entry: RealtimeTranscriptEntry }) {
  if (entry.role === "system") {
    return (
      <p className="self-center px-inset-sm text-center text-2xs text-muted-foreground">
        {entry.text}
      </p>
    );
  }

  const mine = entry.role === "user";

  return (
    <div className={cn("flex flex-col gap-stack-xs", mine ? "items-end" : "items-start")}>
      <span className="px-1 text-2xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
        {mine ? "You" : "Organic"}
      </span>
      <p
        className={cn(
          "max-w-[92%] whitespace-pre-wrap rounded-2xl px-inset-md py-2 text-sm leading-relaxed",
          mine
            ? "rounded-br-md bg-foreground/[0.08] text-foreground"
            : "rounded-bl-md border border-border/50 bg-background/40 text-foreground",
          entry.interim && "opacity-70"
        )}
      >
        {entry.text}
      </p>
    </div>
  );
}
