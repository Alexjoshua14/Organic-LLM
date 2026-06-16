"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

import { AssistantMessageActions } from "@/components/chat/assistant-message-actions";
import { ChatAIAction } from "@/components/chat/chat-message";
import { ChatMessageMarkdown } from "@/components/chat/chat-message-markdown";
import { MemorySearchToolResultCard } from "@/components/chat/memory-search-tool-result";
import { WebSearchToolResultCard } from "@/components/chat/web-search-tool-result";
import { usePageVisible } from "@/components/hooks/use-page-visible";
import { useWelcomeInView } from "@/components/pages/welcome/use-welcome-in-view";
import {
  WelcomeDemoUserMessage,
  welcomeDemoCompactClass,
} from "@/components/pages/welcome/welcome-demo-user-message";
import type { ExaSearchResultSource } from "@/lib/exa/types";
import { card, sectionLabel } from "@/lib/rabbit-holes/designTokens";
import {
  WELCOME_MAIN_CHAT_ASSISTANT_REPLY,
  WELCOME_MAIN_CHAT_MEMORY_RESULT,
  WELCOME_MAIN_CHAT_SEARCH_RESULT,
  WELCOME_MAIN_CHAT_USER_PROMPT,
} from "@/lib/welcome/main-chat-fixtures";
import { ChatAIActionEnum } from "@/types/ai";
import { cn } from "@/lib/utils";

type WelcomeMainChatIllustrationProps = {
  className?: string;
};

type Phase =
  | "typing"
  | "sent"
  | "memoryLoad"
  | "memoryResult"
  | "searchLoad"
  | "searchResult"
  | "streaming"
  | "complete";

type FooterView = "composer" | "hint";

const TYPING_CHAR_MS = 40;
const SENT_HOLD_MS = 420;
const MEMORY_LOAD_MS = 750;
const MEMORY_RESULT_MS = 700;
const SEARCH_LOAD_MS = 700;
const SEARCH_RESULT_MS = 550;
const STREAM_MS = 34;
const COMPLETE_HOLD_MS = 10_000;
const RESET_MS = 500;

const VIEW_TRANSITION = { duration: 0.32, ease: [0.22, 1, 0.36, 1] as const };

const ARIA_LABEL =
  "Main chat retrieves memories, searches the web, streams a polished reply, and offers read-aloud and copy actions.";

function tokens(text: string): string[] {
  return text.match(/\S+\s*/g) ?? [text];
}

function WelcomeMemorySearchCard() {
  return (
    <MemorySearchToolResultCard
      isPinned={false}
      parsed={WELCOME_MAIN_CHAT_MEMORY_RESULT}
      showPin={false}
      onTogglePin={() => {}}
    />
  );
}

function WelcomeWebSearchCard() {
  return (
    <WebSearchToolResultCard
      isPinned={false}
      parsed={WELCOME_MAIN_CHAT_SEARCH_RESULT}
      showPin={false}
      onTogglePin={() => {}}
    />
  );
}

export function WelcomeMainChatIllustration({ className }: WelcomeMainChatIllustrationProps) {
  const reduce = useReducedMotion();
  const pageVisible = usePageVisible();
  const rootRef = useRef<HTMLDivElement>(null);
  const threadRef = useRef<HTMLDivElement>(null);
  const inView = useWelcomeInView(rootRef);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const typeRafRef = useRef<number | null>(null);
  const streamRafRef = useRef<number | null>(null);
  const loopActiveRef = useRef(false);

  const replyTokens = useMemo(() => tokens(WELCOME_MAIN_CHAT_ASSISTANT_REPLY), []);

  const memoryLoadingMessage = useMemo(() => {
    if (WELCOME_MAIN_CHAT_MEMORY_RESULT.status !== "ok") {
      return "Searching memories...";
    }

    const query = WELCOME_MAIN_CHAT_MEMORY_RESULT.query.trim();
    const qShort = query.length > 56 ? `${query.slice(0, 56)}…` : query;

    return `Searching memories for "${qShort}"`;
  }, []);

  const searchSources = useMemo<ExaSearchResultSource[]>(() => {
    if (WELCOME_MAIN_CHAT_SEARCH_RESULT.status !== "success") {
      return [];
    }

    return WELCOME_MAIN_CHAT_SEARCH_RESULT.rows.map((row) => ({
      id: row.id,
      title: row.title,
      url: row.url,
      faviconUrl: row.faviconUrl,
    }));
  }, []);

  const [phase, setPhase] = useState<Phase>("typing");
  const [footerView, setFooterView] = useState<FooterView>("composer");
  const [composerText, setComposerText] = useState("");
  const [showUserBubble, setShowUserBubble] = useState(false);
  const [streamCount, setStreamCount] = useState(0);

  const clearTimers = useCallback(() => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
  }, []);

  const clearTypeRaf = useCallback(() => {
    if (typeRafRef.current !== null) {
      cancelAnimationFrame(typeRafRef.current);
      typeRafRef.current = null;
    }
  }, []);

  const clearStreamRaf = useCallback(() => {
    if (streamRafRef.current !== null) {
      cancelAnimationFrame(streamRafRef.current);
      streamRafRef.current = null;
    }
  }, []);

  const schedule = useCallback((fn: () => void, ms: number) => {
    const id = setTimeout(fn, ms);

    timersRef.current.push(id);
  }, []);

  const scrollThreadToEnd = useCallback(() => {
    const node = threadRef.current;

    if (!node) return;

    requestAnimationFrame(() => {
      node.scrollTop = node.scrollHeight;
    });
  }, []);

  const resetLoop = useCallback(() => {
    loopActiveRef.current = false;
    clearTimers();
    clearTypeRaf();
    clearStreamRaf();
    setPhase("typing");
    setFooterView("composer");
    setComposerText("");
    setShowUserBubble(false);
    setStreamCount(0);
  }, [clearStreamRaf, clearTimers, clearTypeRaf]);

  const runTyping = useCallback(
    (onComplete: () => void) => {
      clearTypeRaf();
      setComposerText("");

      let index = 0;
      const start = performance.now();

      const tick = (now: number) => {
        const nextIndex = Math.min(
          WELCOME_MAIN_CHAT_USER_PROMPT.length,
          Math.floor((now - start) / TYPING_CHAR_MS)
        );

        if (nextIndex !== index) {
          index = nextIndex;
          setComposerText(WELCOME_MAIN_CHAT_USER_PROMPT.slice(0, index));
        }

        if (index < WELCOME_MAIN_CHAT_USER_PROMPT.length) {
          typeRafRef.current = requestAnimationFrame(tick);

          return;
        }

        onComplete();
      };

      typeRafRef.current = requestAnimationFrame(tick);
    },
    [clearTypeRaf]
  );

  const runStream = useCallback(
    (onComplete: () => void) => {
      clearStreamRaf();
      setStreamCount(0);

      const start = performance.now();

      const tick = (now: number) => {
        const count = Math.min(
          replyTokens.length,
          Math.floor((now - start) / STREAM_MS)
        );

        setStreamCount(count);

        if (count < replyTokens.length) {
          streamRafRef.current = requestAnimationFrame(tick);

          return;
        }

        onComplete();
      };

      streamRafRef.current = requestAnimationFrame(tick);
    },
    [clearStreamRaf, replyTokens.length]
  );

  const startLoop = useCallback(() => {
    if (loopActiveRef.current) return;
    loopActiveRef.current = true;

    const runCycle = () => {
      setPhase("typing");
      setFooterView("composer");
      setComposerText("");
      setShowUserBubble(false);
      setStreamCount(0);

      schedule(() => {
        runTyping(() => {
          setShowUserBubble(true);
          setComposerText("");
          setPhase("sent");

          schedule(() => {
            setFooterView("hint");
            setPhase("memoryLoad");

            schedule(() => {
              setPhase("memoryResult");

              schedule(() => {
                setPhase("searchLoad");

                schedule(() => {
                  setPhase("searchResult");

                  schedule(() => {
                    setPhase("streaming");
                    runStream(() => {
                      setPhase("complete");

                      schedule(() => {
                        loopActiveRef.current = false;
                        schedule(() => startLoop(), RESET_MS);
                      }, COMPLETE_HOLD_MS);
                    });
                  }, SEARCH_RESULT_MS);
                }, SEARCH_LOAD_MS);
              }, MEMORY_RESULT_MS);
            }, MEMORY_LOAD_MS);
          }, SENT_HOLD_MS);
        });
      }, 280);
    };

    runCycle();
  }, [runStream, runTyping, schedule]);

  const active = inView && pageVisible && !reduce;

  useEffect(() => {
    if (!active) {
      resetLoop();

      return;
    }

    startLoop();

    return () => {
      resetLoop();
    };
  }, [active, resetLoop, startLoop]);

  useEffect(() => {
    scrollThreadToEnd();
  }, [phase, showUserBubble, streamCount, scrollThreadToEnd]);

  const streamedText = replyTokens.slice(0, streamCount).join("");
  const showMemoryLoad = phase === "memoryLoad";
  const showMemoryResult =
    phase === "memoryResult" ||
    phase === "searchLoad" ||
    phase === "searchResult" ||
    phase === "streaming" ||
    phase === "complete";
  const showSearchLoad = phase === "searchLoad";
  const showSearchResult =
    phase === "searchResult" || phase === "streaming" || phase === "complete";
  const showStreaming = phase === "streaming" || phase === "complete";
  const showActions = phase === "complete";

  const frameClass = cn(
    "flex h-full min-h-0 flex-col justify-start px-2.5 py-3 sm:px-3 sm:py-4",
    className
  );

  if (reduce) {
    return (
      <div ref={rootRef} aria-label={ARIA_LABEL} className={frameClass} role="img">
        <p className={cn(sectionLabel, "mb-2 text-center")}>Main chat</p>
        <div className={cn(card, "flex min-h-0 flex-1 flex-col gap-2 overflow-hidden rounded-lg p-2.5 sm:p-3", welcomeDemoCompactClass)}>
          <WelcomeDemoUserMessage
            animate={false}
            id="welcome-main-chat-user-reduced"
            text={WELCOME_MAIN_CHAT_USER_PROMPT}
          />
          <WelcomeMemorySearchCard />
          <WelcomeWebSearchCard />
          <ChatMessageMarkdown
            content={WELCOME_MAIN_CHAT_ASSISTANT_REPLY}
            id="welcome-main-chat-reduced"
          />
          <AssistantMessageActions
            showPinAndCopy
            text={WELCOME_MAIN_CHAT_ASSISTANT_REPLY}
          />
        </div>
      </div>
    );
  }

  return (
    <div ref={rootRef} aria-label={ARIA_LABEL} className={frameClass} role="img">
      <div className="mb-2 flex shrink-0 flex-col items-center gap-0.5 text-center">
        <p className={sectionLabel}>Main chat</p>
        <span className="text-[10px] text-muted-foreground/75">
          Memory, search, stream, read aloud
        </span>
      </div>

      <div className={cn(card, "flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg", welcomeDemoCompactClass)}>
        <div
          ref={threadRef}
          className="flex min-h-[5.5rem] flex-1 flex-col gap-2 overflow-y-auto px-2.5 py-2.5 sm:min-h-[6.5rem] sm:px-3 sm:py-3"
        >
          {!showUserBubble ? (
            <p className="py-3 text-center text-[10px] text-muted-foreground/55">
              Thread with tools you can inspect
            </p>
          ) : (
            <WelcomeDemoUserMessage
              id="welcome-main-chat-user"
              text={WELCOME_MAIN_CHAT_USER_PROMPT}
            />
          )}

          <AnimatePresence initial={false}>
            {showMemoryLoad ? (
              <motion.div
                key="memory-load"
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                initial={{ opacity: 0, y: 4 }}
                transition={VIEW_TRANSITION}
              >
                <ChatAIAction
                  aiActionPayload={{
                    action: ChatAIActionEnum.Memory,
                    message: memoryLoadingMessage,
                  }}
                />
              </motion.div>
            ) : null}
          </AnimatePresence>

          {showMemoryResult ? (
            <motion.div
              animate={{ opacity: 1, y: 0 }}
              initial={{ opacity: 0, y: 4 }}
              transition={VIEW_TRANSITION}
            >
              <WelcomeMemorySearchCard />
            </motion.div>
          ) : null}

          <AnimatePresence initial={false}>
            {showSearchLoad ? (
              <motion.div
                key="search-load"
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                initial={{ opacity: 0, y: 4 }}
                transition={VIEW_TRANSITION}
              >
                <ChatAIAction
                  aiActionPayload={{
                    action: ChatAIActionEnum.Search,
                    sources: searchSources,
                  }}
                />
              </motion.div>
            ) : null}
          </AnimatePresence>

          {showSearchResult ? (
            <motion.div
              animate={{ opacity: 1, y: 0 }}
              initial={{ opacity: 0, y: 4 }}
              transition={VIEW_TRANSITION}
            >
              <WelcomeWebSearchCard />
            </motion.div>
          ) : null}

          {showStreaming ? (
            <motion.div
              animate={{ opacity: 1, y: 0 }}
              className="mr-auto w-full max-w-[95%]"
              initial={{ opacity: 0, y: 4 }}
              transition={VIEW_TRANSITION}
            >
              <div className="ai-message max-w-full text-foreground prose dark:prose-invert">
                <ChatMessageMarkdown
                  content={streamedText}
                  id="welcome-main-chat-stream"
                />
                {phase === "streaming" ? (
                  <motion.span
                    animate={{ opacity: [0.35, 0.9, 0.35] }}
                    aria-hidden
                    className="ml-px text-muted-foreground/60"
                    transition={{ duration: 1.1, ease: "easeInOut", repeat: Infinity }}
                  >
                    |
                  </motion.span>
                ) : null}
              </div>
            </motion.div>
          ) : null}

          {showActions ? (
            <motion.div
              animate={{ opacity: 1, y: 0 }}
              initial={{ opacity: 0, y: 4 }}
              transition={VIEW_TRANSITION}
            >
              <AssistantMessageActions
                showPinAndCopy
                text={WELCOME_MAIN_CHAT_ASSISTANT_REPLY}
              />
            </motion.div>
          ) : null}
        </div>

        <div className="shrink-0 border-t border-border/40 px-2.5 py-2 sm:px-3 sm:py-2.5">
          <AnimatePresence initial={false} mode="wait">
            {footerView === "composer" ? (
              <motion.div
                key="composer"
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 4 }}
                initial={{ opacity: 0, y: -6 }}
                transition={VIEW_TRANSITION}
              >
                <div className="min-h-[2.75rem] rounded-lg border border-border/55 bg-background/55 px-2.5 py-2">
                  <p className="text-[10px] leading-relaxed text-foreground/90">
                    {composerText}
                    {phase === "typing" ? (
                      <motion.span
                        animate={{ opacity: [0.35, 0.9, 0.35] }}
                        aria-hidden
                        className="ml-px text-muted-foreground/60"
                        transition={{ duration: 1.1, ease: "easeInOut", repeat: Infinity }}
                      >
                        |
                      </motion.span>
                    ) : null}
                  </p>
                </div>
              </motion.div>
            ) : (
              <motion.p
                key="hint"
                animate={{ opacity: 1 }}
                className="py-1 text-center text-[10px] text-muted-foreground/60"
                exit={{ opacity: 0 }}
                initial={{ opacity: 0.45 }}
                transition={VIEW_TRANSITION}
              >
                {phase === "complete"
                  ? "Read aloud, pin, or copy when the reply lands"
                  : "Tools and reply build in-thread"}
              </motion.p>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
