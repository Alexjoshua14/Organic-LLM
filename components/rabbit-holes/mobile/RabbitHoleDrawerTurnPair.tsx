"use client";

import type { UIMessage } from "ai";
import type { DrawerChatTurn } from "@/lib/rabbit-holes/drawer-turns";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useRef } from "react";

import { ChatMessage } from "@/components/chat/chat-message";
import { ChatReasoning, ChatThinking } from "@/components/chat/chat-loading";
import { glass } from "@/components/design-system/primitives";
import { useDrawerTurnSwipe } from "@/hooks/use-drawer-turn-swipe";
import { cn } from "@/lib/utils";
import { ChatAIActionEnum } from "@/types/ai";

type RabbitHoleDrawerTurnPairProps = {
  turn: DrawerChatTurn | null;
  turnIndex: number;
  turnCount: number;
  chatId: string;
  isStreaming?: boolean;
  aiActionMessage?: string;
  swipeDirection?: "older" | "newer" | null;
  onTurnIndexChange: (index: number) => void;
  aiBlockRef?: React.RefObject<HTMLDivElement | null>;
  aiScrollClassName?: string;
  className?: string;
};

export function RabbitHoleDrawerTurnPair({
  turn,
  turnIndex,
  turnCount,
  chatId,
  isStreaming = false,
  aiActionMessage,
  swipeDirection,
  onTurnIndexChange,
  aiBlockRef: aiBlockRefProp,
  aiScrollClassName = "max-h-[50vh]",
  className,
}: RabbitHoleDrawerTurnPairProps) {
  const reduceMotion = useReducedMotion();
  const internalAiRef = useRef<HTMLDivElement>(null);
  const aiScrollRef = aiBlockRefProp ?? internalAiRef;
  const { onTouchStart, onTouchEnd } = useDrawerTurnSwipe({
    turnCount,
    turnIndex,
    onTurnIndexChange,
    aiScrollRef,
  });

  const slideY = swipeDirection === "older" ? -24 : swipeDirection === "newer" ? 24 : 0;

  return (
    <div
      className={cn("flex min-h-0 flex-col gap-2", className)}
      onTouchEnd={onTouchEnd}
      onTouchStart={onTouchStart}
    >
      {turnCount > 1 ? (
        <p className="text-center text-2xs uppercase tracking-[0.2em] text-muted-foreground">
          Turn {turnIndex + 1} / {turnCount}
        </p>
      ) : null}

      <AnimatePresence initial={false} mode="wait">
        <motion.div
          key={turn?.user.id ?? `empty-${turnIndex}`}
          animate={{ opacity: 1, y: 0 }}
          className="flex min-h-0 flex-col gap-2"
          exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: slideY }}
          initial={reduceMotion ? { opacity: 1 } : { opacity: 0, y: -slideY }}
          transition={{ duration: reduceMotion ? 0 : 0.22 }}
        >
          {turn ? (
            <>
              <div className="flex justify-end">
                <div
                  className={cn(
                    "max-w-[92%] rounded-2xl rounded-br-md px-3 py-2 text-sm",
                    glass({ opaque: true })
                  )}
                >
                  <ChatMessage chatId={chatId} message={turn.user} />
                </div>
              </div>
              <div
                ref={aiScrollRef}
                className={cn(
                  aiScrollClassName,
                  "min-h-0 flex-1 overflow-y-auto rounded-2xl rounded-bl-md px-3 py-2 text-sm",
                  glass({ opaque: true })
                )}
              >
                {turn.assistant ? (
                  <ChatMessage
                    chatId={chatId}
                    isLastMessage
                    message={turn.assistant}
                  />
                ) : isStreaming ? (
                  aiActionMessage?.toLowerCase().includes("reason") ? (
                    <ChatReasoning text={aiActionMessage} />
                  ) : (
                    <ChatThinking text={aiActionMessage} />
                  )
                ) : (
                  <p className="text-sm text-muted-foreground">Waiting for a reply…</p>
                )}
              </div>
            </>
          ) : (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Ask a question to start the conversation.
            </p>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

export type { UIMessage };
