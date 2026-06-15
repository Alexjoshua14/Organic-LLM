"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Loader2, RefreshCw, Sparkles } from "lucide-react";

import { usePageVisible } from "@/components/hooks/use-page-visible";
import { useWelcomeInView } from "@/components/pages/welcome/use-welcome-in-view";
import ShinyText from "@/components/ShinyText";
import { glass } from "@/components/design-system/primitives";
import { card, sectionLabel } from "@/lib/rabbit-holes/designTokens";
import {
  NOESIS_SPARK_SOURCE_LABEL,
  WELCOME_NOESIS_SCENARIOS,
  type NoesisSpark,
  type WelcomeNoesisScenario,
} from "@/lib/welcome/noesis-fixtures";
import { cn } from "@/lib/utils";

type WelcomeNoesisIllustrationProps = {
  className?: string;
};

type ThreadMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
};

type FooterView = "sparks" | "composer";

const SPARKS_HOLD_MS = 4000;
const SELECT_MS = 1000;
const ASSISTANT_STREAM_MS = 36;
const ASSISTANT_HOLD_MS = 2200;
const COMPOSER_HOLD_MS = 1200;
const ASSIST_HOLD_MS = 3800;
const REGENERATE_MS = 1500;
const ASSIST_CHAR_MS = 44;
const SPARK_SWAP_MS = 320;
const END_HOLD_MS = 2800;

const VIEW_TRANSITION = { duration: 0.4, ease: [0.22, 1, 0.36, 1] as const };

const ARIA_LABEL =
  "Noesis uses memory for tailored starter prompts and reply suggestions, building into a conversation.";

function tokens(text: string): string[] {
  return text.match(/\S+\s*/g) ?? [text];
}

function SparkCard({
  spark,
  selected,
  dimmed,
}: {
  spark: NoesisSpark;
  selected: boolean;
  dimmed: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-lg border px-2.5 py-2 text-left transition-colors duration-500",
        selected
          ? "border-accent/45 bg-background-secondary/80 shadow-sm"
          : "border-border/60 bg-background-secondary/35",
        dimmed && !selected && "opacity-45"
      )}
    >
      <div className="flex items-start gap-2">
        <span className="w-[4.75rem] shrink-0 pt-px text-[10px] font-medium uppercase leading-tight tracking-wide text-muted-foreground/75">
          {NOESIS_SPARK_SOURCE_LABEL[spark.source]}
        </span>
        <p className="min-w-0 flex-1 text-[11px] leading-snug text-foreground/90 sm:text-xs">
          {spark.text}
        </p>
      </div>
    </div>
  );
}

function ThreadUserBubble({ text }: { text: string }) {
  return (
    <motion.div
      animate={{ opacity: 1, y: 0 }}
      className="ml-auto w-fit max-w-[90%]"
      initial={{ opacity: 0, y: 6 }}
      transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className={cn(glass(), "rounded-lg px-2.5 py-2 text-xs leading-snug text-foreground")}>
        {text}
      </div>
    </motion.div>
  );
}

function ThreadAssistantBubble({ text, streaming }: { text: string; streaming?: boolean }) {
  return (
    <motion.div
      animate={{ opacity: 1, y: 0 }}
      className="mr-auto w-full max-w-[95%]"
      initial={{ opacity: 0, y: 4 }}
      transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
    >
      <p className="text-xs leading-relaxed text-foreground/88">
        {text}
        {streaming ? (
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
    </motion.div>
  );
}

export function WelcomeNoesisIllustration({ className }: WelcomeNoesisIllustrationProps) {
  const reduce = useReducedMotion();
  const pageVisible = usePageVisible();
  const rootRef = useRef<HTMLDivElement>(null);
  const threadRef = useRef<HTMLDivElement>(null);
  const inView = useWelcomeInView(rootRef);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const streamRafRef = useRef<number | null>(null);
  const typeRafRef = useRef<number | null>(null);
  const loopActiveRef = useRef(false);
  const scenarioIndexRef = useRef(0);
  const hasShownSparksRef = useRef(false);
  const messageIdRef = useRef(0);

  const [scenarioIndex, setScenarioIndex] = useState(0);
  const [footerView, setFooterView] = useState<FooterView>("sparks");
  const [threadMessages, setThreadMessages] = useState<ThreadMessage[]>([]);
  const [streamingAssistantId, setStreamingAssistantId] = useState<string | null>(null);
  const [selectedSparkIndex, setSelectedSparkIndex] = useState<number | null>(null);
  const [composerText, setComposerText] = useState("");
  const [assistPending, setAssistPending] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [sparksVisible, setSparksVisible] = useState(true);

  const scenario = WELCOME_NOESIS_SCENARIOS[scenarioIndex] ?? WELCOME_NOESIS_SCENARIOS[0]!;

  const nextMessageId = useCallback(() => {
    messageIdRef.current += 1;

    return `noesis-msg-${messageIdRef.current}`;
  }, []);

  const scrollThreadToEnd = useCallback(() => {
    const node = threadRef.current;

    if (!node) return;

    requestAnimationFrame(() => {
      node.scrollTop = node.scrollHeight;
    });
  }, []);

  const clearTimers = useCallback(() => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
  }, []);

  const clearStreamRaf = useCallback(() => {
    if (streamRafRef.current !== null) {
      cancelAnimationFrame(streamRafRef.current);
      streamRafRef.current = null;
    }
  }, []);

  const clearTypeRaf = useCallback(() => {
    if (typeRafRef.current !== null) {
      cancelAnimationFrame(typeRafRef.current);
      typeRafRef.current = null;
    }
  }, []);

  const schedule = useCallback((fn: () => void, ms: number) => {
    const id = setTimeout(fn, ms);

    timersRef.current.push(id);
  }, []);

  const resetLoop = useCallback(() => {
    loopActiveRef.current = false;
    clearTimers();
    clearStreamRaf();
    clearTypeRaf();
    hasShownSparksRef.current = false;
    messageIdRef.current = 0;
    scenarioIndexRef.current = 0;
    setScenarioIndex(0);
    setFooterView("sparks");
    setThreadMessages([]);
    setStreamingAssistantId(null);
    setSelectedSparkIndex(null);
    setComposerText("");
    setAssistPending(false);
    setRegenerating(false);
    setSparksVisible(true);
  }, [clearStreamRaf, clearTimers, clearTypeRaf]);

  const appendMessage = useCallback(
    (role: ThreadMessage["role"], text: string) => {
      const id = nextMessageId();
      const message: ThreadMessage = { id, role, text };

      setThreadMessages((current) => [...current, message]);
      scrollThreadToEnd();

      return id;
    },
    [nextMessageId, scrollThreadToEnd]
  );

  const updateMessageText = useCallback(
    (id: string, text: string) => {
      setThreadMessages((current) =>
        current.map((message) => (message.id === id ? { ...message, text } : message))
      );
      scrollThreadToEnd();
    },
    [scrollThreadToEnd]
  );

  const streamAssistantReply = useCallback(
    (fullText: string, onComplete: () => void) => {
      clearStreamRaf();
      const id = appendMessage("assistant", "");
      const parts = tokens(fullText);

      setStreamingAssistantId(id);

      const start = performance.now();

      const tick = (now: number) => {
        const count = Math.min(parts.length, Math.floor((now - start) / ASSISTANT_STREAM_MS));

        updateMessageText(id, parts.slice(0, count).join(""));

        if (count < parts.length) {
          streamRafRef.current = requestAnimationFrame(tick);

          return;
        }

        setStreamingAssistantId(null);
        onComplete();
      };

      streamRafRef.current = requestAnimationFrame(tick);
    },
    [appendMessage, clearStreamRaf, updateMessageText]
  );

  const runAssistTyping = useCallback(
    (draft: string, onComplete: () => void) => {
      clearTypeRaf();
      setAssistPending(true);
      setComposerText("");

      let index = 0;
      const start = performance.now();

      const tick = (now: number) => {
        const nextIndex = Math.min(draft.length, Math.floor((now - start) / ASSIST_CHAR_MS));

        if (nextIndex !== index) {
          index = nextIndex;
          setComposerText(draft.slice(0, index));
        }

        if (index < draft.length) {
          typeRafRef.current = requestAnimationFrame(tick);

          return;
        }

        setAssistPending(false);
        onComplete();
      };

      typeRafRef.current = requestAnimationFrame(tick);
    },
    [clearTypeRaf]
  );

  const startLoop = useCallback(() => {
    if (loopActiveRef.current) return;
    loopActiveRef.current = true;

    const swapScenario = (nextIndex: number, onComplete: () => void) => {
      setRegenerating(true);
      setSparksVisible(false);

      schedule(() => {
        scenarioIndexRef.current = nextIndex;
        setScenarioIndex(nextIndex);
        setThreadMessages([]);
        setStreamingAssistantId(null);
        setSelectedSparkIndex(null);
        setComposerText("");
        setFooterView("sparks");
        setSparksVisible(true);
        setRegenerating(false);
        schedule(onComplete, SPARK_SWAP_MS);
      }, REGENERATE_MS);
    };

    const runComposerBeat = (activeScenario: WelcomeNoesisScenario) => {
      setFooterView("composer");
      setComposerText("");

      schedule(() => {
        runAssistTyping(activeScenario.assistDraft, () => {
          schedule(() => {
            appendMessage("user", activeScenario.assistDraft);
            setComposerText("");
            setFooterView("sparks");

            schedule(() => {
              streamAssistantReply(activeScenario.assistantReply2, () => {
                schedule(() => {
                  const nextScenario =
                    (scenarioIndexRef.current + 1) % WELCOME_NOESIS_SCENARIOS.length;

                  swapScenario(nextScenario, () => {
                    loopActiveRef.current = false;
                    startLoop();
                  });
                }, END_HOLD_MS);
              });
            }, SELECT_MS);
          }, ASSIST_HOLD_MS);
        });
      }, COMPOSER_HOLD_MS);
    };

    const runFirstReply = (activeScenario: WelcomeNoesisScenario, userText: string) => {
      appendMessage("user", userText);
      setFooterView("sparks");
      setSelectedSparkIndex(null);

      schedule(() => {
        streamAssistantReply(activeScenario.assistantReply1, () => {
          schedule(() => runComposerBeat(activeScenario), ASSISTANT_HOLD_MS);
        });
      }, SELECT_MS);
    };

    const runSparksBeat = (activeScenario: WelcomeNoesisScenario) => {
      const pick = activeScenario.selectedSparkIndex;
      const userText = activeScenario.sparks[pick]!.text;

      setFooterView("sparks");
      setSelectedSparkIndex(null);
      setThreadMessages([]);
      setStreamingAssistantId(null);
      setComposerText("");

      schedule(() => {
        setSelectedSparkIndex(pick);
        schedule(() => runFirstReply(activeScenario, userText), SELECT_MS);
      }, SPARKS_HOLD_MS);
    };

    const runScenario = (index: number) => {
      scenarioIndexRef.current = index;
      setScenarioIndex(index);
      setSparksVisible(true);
      setRegenerating(false);
      runSparksBeat(WELCOME_NOESIS_SCENARIOS[index]!);
    };

    runScenario(scenarioIndexRef.current);
  }, [
    appendMessage,
    runAssistTyping,
    schedule,
    streamAssistantReply,
  ]);

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
  }, [threadMessages.length, scrollThreadToEnd]);

  const frameClass = cn(
    "flex h-full min-h-0 flex-col justify-start px-2.5 py-3 sm:px-3 sm:py-4",
    className
  );

  if (reduce) {
    const staticScenario = WELCOME_NOESIS_SCENARIOS[0]!;
    const spark = staticScenario.sparks[staticScenario.selectedSparkIndex]!;

    return (
      <div ref={rootRef} aria-label={ARIA_LABEL} className={frameClass} role="img">
        <p className={cn(sectionLabel, "mb-2 text-center")}>Starter prompts</p>
        <p className="mb-3 text-center text-[10px] text-muted-foreground/75">
          Uses memory for tailored suggestions
        </p>
        <div className={cn(card, "flex min-h-0 flex-1 flex-col gap-2 rounded-lg p-2.5")}>
          <div className="flex min-h-0 flex-1 flex-col gap-2">
            <ThreadUserBubble text={spark.text} />
            <ThreadAssistantBubble text={staticScenario.assistantReply1} />
            <ThreadUserBubble text={staticScenario.assistDraft} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div ref={rootRef} aria-label={ARIA_LABEL} className={frameClass} role="img">
      <div className="mb-2 flex shrink-0 flex-col items-center gap-0.5 text-center">
        <p className={sectionLabel}>Starter prompts</p>
        <span className="text-[10px] text-muted-foreground/75">
          Uses memory for tailored suggestions
        </span>
      </div>

      <div className={cn(card, "flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg")}>
        <div
          ref={threadRef}
          className="flex min-h-[5.5rem] flex-1 flex-col gap-2.5 overflow-y-auto px-2.5 py-2.5 sm:min-h-[6.5rem] sm:px-3 sm:py-3"
        >
          {threadMessages.length === 0 ? (
            <p className="py-4 text-center text-[11px] text-muted-foreground/55">
              Pick a spark to start a thread
            </p>
          ) : (
            threadMessages.map((message) =>
              message.role === "user" ? (
                <ThreadUserBubble key={message.id} text={message.text} />
              ) : (
                <ThreadAssistantBubble
                  key={message.id}
                  streaming={streamingAssistantId === message.id}
                  text={message.text}
                />
              )
            )
          )}
        </div>

        <div className="shrink-0 border-t border-border/40 px-2.5 py-2 sm:px-3 sm:py-2.5">
          <AnimatePresence initial={false} mode="wait">
            {footerView === "sparks" ? (
              <motion.div
                key="sparks"
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                initial={hasShownSparksRef.current ? false : { opacity: 0, y: 6 }}
                transition={VIEW_TRANSITION}
                onAnimationComplete={() => {
                  hasShownSparksRef.current = true;
                }}
              >
                {threadMessages.length === 0 ? (
                  <>
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground/80">
                        Pick one
                      </span>
                      <span
                        className={cn(
                          "inline-flex items-center gap-1 text-[10px] text-muted-foreground/70",
                          regenerating && "text-foreground/80"
                        )}
                      >
                        <RefreshCw
                          className={cn("size-3", regenerating && "animate-spin")}
                          strokeWidth={1.75}
                        />
                        Regenerate
                      </span>
                    </div>
                    <motion.div
                      animate={{ opacity: sparksVisible ? 1 : 0.35 }}
                      className="flex flex-col gap-1.5"
                      transition={{ duration: SPARK_SWAP_MS / 1000, ease: "easeInOut" }}
                    >
                      {scenario.sparks.map((spark, index) => (
                        <SparkCard
                          key={`${scenarioIndex}-${index}`}
                          dimmed={selectedSparkIndex !== null && selectedSparkIndex !== index}
                          selected={selectedSparkIndex === index}
                          spark={spark}
                        />
                      ))}
                    </motion.div>
                  </>
                ) : (
                  <p className="text-center text-[10px] text-muted-foreground/60">
                    Thread builds as you explore
                  </p>
                )}
              </motion.div>
            ) : (
              <motion.div
                key="composer"
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 4 }}
                initial={{ opacity: 0, y: -6 }}
                transition={VIEW_TRANSITION}
              >
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <button
                    className="inline-flex items-center gap-1.5 rounded-md border border-border/50 bg-background-secondary/50 px-2 py-1 text-[11px] text-foreground/85"
                    disabled
                    type="button"
                  >
                    {assistPending ? (
                      <Loader2 className="size-3 animate-spin" strokeWidth={1.75} />
                    ) : (
                      <Sparkles className="size-3" strokeWidth={1.75} />
                    )}
                    Suggest my reply
                  </button>
                  {assistPending ? (
                    <ShinyText
                      as="span"
                      className="text-[10px] font-light text-muted-foreground/75"
                      speed={0.85}
                      text="Drafting…"
                    />
                  ) : composerText.length > 0 ? (
                    <span className="text-[10px] text-muted-foreground/70">Edit before you send</span>
                  ) : null}
                </div>
                <div className="min-h-[2.75rem] rounded-lg border border-border/55 bg-background/55 px-2.5 py-2">
                  <p className="text-xs leading-relaxed text-foreground/90">
                    {composerText}
                    {assistPending ? (
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
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
