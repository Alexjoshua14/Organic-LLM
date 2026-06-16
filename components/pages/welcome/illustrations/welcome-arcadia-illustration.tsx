"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

import { MermaidDiagram } from "@/components/blog/mermaid-diagram";
import { usePageVisible } from "@/components/hooks/use-page-visible";
import { useWelcomeInView } from "@/components/pages/welcome/use-welcome-in-view";
import {
  WelcomeDemoUserMessage,
  welcomeDemoCompactClass,
} from "@/components/pages/welcome/welcome-demo-user-message";
import ShinyText from "@/components/ShinyText";
import { Loader } from "@/components/third-party/ai-elements/loader";
import { card, sectionLabel } from "@/lib/rabbit-holes/designTokens";
import {
  WELCOME_ARCADIA_MERMAID,
  WELCOME_ARCADIA_PLANNING_HINT,
  WELCOME_ARCADIA_TOOL_NAME,
  WELCOME_ARCADIA_TOOL_STATUS,
  WELCOME_ARCADIA_USER_PROMPT,
} from "@/lib/welcome/arcadia-fixtures";
import { cn } from "@/lib/utils";

type WelcomeArcadiaIllustrationProps = {
  className?: string;
};

type Phase = "typing" | "sent" | "thinking" | "rendered";
type FooterView = "composer" | "hint";

type ThreadMessage = {
  id: string;
  role: "user";
  text: string;
};

const TYPING_CHAR_MS = 42;
const SENT_HOLD_MS = 480;
const THINKING_MS = 1100;
const RENDERED_HOLD_MS = 5200;
const RESET_MS = 500;

const VIEW_TRANSITION = { duration: 0.32, ease: [0.22, 1, 0.36, 1] as const };

const ARIA_LABEL =
  "A user asks why an idea loses momentum; Arcadia renders a mind map of spark, scope, blur, friction, and drift.";

export function WelcomeArcadiaIllustration({ className }: WelcomeArcadiaIllustrationProps) {
  const reduce = useReducedMotion();
  const pageVisible = usePageVisible();
  const rootRef = useRef<HTMLDivElement>(null);
  const threadRef = useRef<HTMLDivElement>(null);
  const inView = useWelcomeInView(rootRef);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const typeRafRef = useRef<number | null>(null);
  const loopActiveRef = useRef(false);
  const messageIdRef = useRef(0);

  const [phase, setPhase] = useState<Phase>("typing");
  const [footerView, setFooterView] = useState<FooterView>("composer");
  const [threadMessages, setThreadMessages] = useState<ThreadMessage[]>([]);
  const [composerText, setComposerText] = useState("");

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

  const appendUserMessage = useCallback(
    (text: string) => {
      messageIdRef.current += 1;
      setThreadMessages([{ id: `arcadia-msg-${messageIdRef.current}`, role: "user", text }]);
      scrollThreadToEnd();
    },
    [scrollThreadToEnd]
  );

  const resetLoop = useCallback(() => {
    loopActiveRef.current = false;
    clearTimers();
    clearTypeRaf();
    messageIdRef.current = 0;
    setPhase("typing");
    setFooterView("composer");
    setThreadMessages([]);
    setComposerText("");
  }, [clearTimers, clearTypeRaf]);

  const runTyping = useCallback(
    (onComplete: () => void) => {
      clearTypeRaf();
      setComposerText("");

      let index = 0;
      const start = performance.now();

      const tick = (now: number) => {
        const nextIndex = Math.min(
          WELCOME_ARCADIA_USER_PROMPT.length,
          Math.floor((now - start) / TYPING_CHAR_MS)
        );

        if (nextIndex !== index) {
          index = nextIndex;
          setComposerText(WELCOME_ARCADIA_USER_PROMPT.slice(0, index));
        }

        if (index < WELCOME_ARCADIA_USER_PROMPT.length) {
          typeRafRef.current = requestAnimationFrame(tick);

          return;
        }

        onComplete();
      };

      typeRafRef.current = requestAnimationFrame(tick);
    },
    [clearTypeRaf]
  );

  const startLoop = useCallback(() => {
    if (loopActiveRef.current) return;
    loopActiveRef.current = true;

    const runCycle = () => {
      setPhase("typing");
      setFooterView("composer");
      setThreadMessages([]);
      setComposerText("");

      schedule(() => {
        runTyping(() => {
          appendUserMessage(WELCOME_ARCADIA_USER_PROMPT);
          setComposerText("");
          setPhase("sent");

          schedule(() => {
            setFooterView("hint");
            setPhase("thinking");

            schedule(() => {
              setPhase("rendered");

              schedule(() => {
                loopActiveRef.current = false;
                schedule(() => startLoop(), RESET_MS);
              }, RENDERED_HOLD_MS);
            }, THINKING_MS);
          }, SENT_HOLD_MS);
        });
      }, 280);
    };

    runCycle();
  }, [appendUserMessage, runTyping, schedule]);

  const active = inView && pageVisible && !reduce;
  const mountDiagram = inView && pageVisible;
  const showThinking = phase === "thinking";
  const showDiagram = phase === "rendered" || reduce;

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
  }, [phase, threadMessages.length, scrollThreadToEnd]);

  const frameClass = cn(
    "flex h-full min-h-0 flex-col justify-start px-2.5 py-3 sm:px-3 sm:py-4",
    className
  );

  const diagramClass =
    "flex w-full justify-center overflow-hidden [&_.mermaid]:my-0 [&_.mermaid]:max-w-full [&_svg]:h-auto [&_svg]:max-w-full";

  if (reduce) {
    return (
      <div ref={rootRef} aria-label={ARIA_LABEL} className={frameClass} role="img">
        <div className="mb-2 flex shrink-0 flex-col items-center gap-0.5 text-center">
          <p className={sectionLabel}>Arcadia tool</p>
          <span className="font-mono text-[10px] text-muted-foreground/75">
            {WELCOME_ARCADIA_TOOL_NAME}
          </span>
        </div>

        <div className={cn(card, "flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg", welcomeDemoCompactClass)}>
          <div className="flex min-h-[5.5rem] flex-1 flex-col gap-2.5 overflow-y-auto px-2.5 py-2.5 sm:min-h-[6.5rem] sm:px-3 sm:py-3">
            <WelcomeDemoUserMessage
              animate={false}
              id="welcome-arcadia-user-reduced"
              text={WELCOME_ARCADIA_USER_PROMPT}
            />
            {mountDiagram ? (
              <div className={diagramClass}>
                <MermaidDiagram code={WELCOME_ARCADIA_MERMAID} />
              </div>
            ) : null}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div ref={rootRef} aria-label={ARIA_LABEL} className={frameClass} role="img">
      <div className="mb-2 flex shrink-0 flex-col items-center gap-0.5 text-center">
        <p className={sectionLabel}>Arcadia tool</p>
        <span className="font-mono text-[10px] text-muted-foreground/75">
          {WELCOME_ARCADIA_TOOL_NAME}
        </span>
      </div>

      <div className={cn(card, "flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg", welcomeDemoCompactClass)}>
        <div
          ref={threadRef}
          className="flex min-h-[5.5rem] flex-1 flex-col gap-2 overflow-y-auto px-2.5 py-2.5 sm:min-h-[6.5rem] sm:px-3 sm:py-3"
        >
          {threadMessages.length === 0 ? (
            <p className="py-3 text-center text-[11px] text-muted-foreground/55">
              Ask Arcadia in the thread
            </p>
          ) : (
            threadMessages.map((message) => (
              <WelcomeDemoUserMessage
                key={message.id}
                id={message.id}
                text={message.text}
              />
            ))
          )}

          <AnimatePresence initial={false}>
            {showThinking ? (
              <motion.div
                key="thinking"
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-2"
                exit={{ opacity: 0, y: -4 }}
                initial={{ opacity: 0, y: 4 }}
                transition={VIEW_TRANSITION}
              >
                <Loader className="size-3 text-muted-foreground/70" />
                <ShinyText
                  as="span"
                  className="text-[10px] font-light tracking-wide text-muted-foreground/80"
                  speed={0.9}
                  text={WELCOME_ARCADIA_TOOL_STATUS.planning}
                />
              </motion.div>
            ) : null}
          </AnimatePresence>

          {showThinking ? (
            <p className="text-center text-[10px] leading-snug text-muted-foreground/60">
              {WELCOME_ARCADIA_PLANNING_HINT}
            </p>
          ) : null}

          {mountDiagram && (showDiagram || showThinking) ? (
            <div
              aria-hidden={!showDiagram}
              className={cn(
                diagramClass,
                "transition-opacity duration-300",
                showDiagram ? "opacity-100" : "pointer-events-none opacity-0"
              )}
            >
              <MermaidDiagram code={WELCOME_ARCADIA_MERMAID} />
            </div>
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
                  <p className="text-xs leading-relaxed text-foreground/90">
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
                {showThinking ? "Waiting on the model…" : "Diagram returned in thread"}
              </motion.p>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
