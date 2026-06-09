"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

import ShinyText from "@/components/ShinyText";
import { Loader } from "@/components/third-party/ai-elements/loader";
import { card, sectionLabel } from "@/lib/rabbit-holes/designTokens";
import { cn } from "@/lib/utils";

type WelcomeStreamResumeIllustrationProps = {
  className?: string;
};

type Phase =
  | "idle"
  | "streaming1"
  | "refreshFlash"
  | "resumedHold"
  | "streaming2"
  | "completeHold";

const MESSAGE =
  "If memory is episodic, tool choice should leave fingerprints across a thread — tracing which retrieval calls ran before the model answered, and whether that pattern repeats on the next turn.";

const TOKENS = MESSAGE.match(/\S+\s*/g) ?? [MESSAGE];
const BREAKPOINT_TOKEN = TOKENS.findIndex((token) => token.trimStart().startsWith("tracing"));

const TOKEN_MS = 38;
const IDLE_MS = 700;
const REFRESH_MS = 1100;
const RESUMED_HOLD_MS = 550;
const COMPLETE_HOLD_MS = 2600;

const TEXT_SLOT_CLASS = "min-h-[5.5rem] text-sm leading-relaxed sm:min-h-[6.5rem]";

const ARIA_LABEL =
  "Assistant reply streaming in a thread, reconnecting after a refresh, then continuing the same server-side stream from the prior partial text.";

function tokensToText(tokenCount: number): string {
  return TOKENS.slice(0, tokenCount).join("");
}

export function WelcomeStreamResumeIllustration({
  className,
}: WelcomeStreamResumeIllustrationProps) {
  const reduce = useReducedMotion();
  const rootRef = useRef<HTMLDivElement>(null);
  const streamIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const loopActiveRef = useRef(false);

  const [inView, setInView] = useState(false);
  const [phase, setPhase] = useState<Phase>("idle");
  const [revealedTokens, setRevealedTokens] = useState(0);

  const breakpoint = useMemo(
    () => (BREAKPOINT_TOKEN >= 0 ? BREAKPOINT_TOKEN : Math.floor(TOKENS.length * 0.55)),
    []
  );

  const clearStreamInterval = useCallback(() => {
    if (streamIntervalRef.current) {
      clearInterval(streamIntervalRef.current);
      streamIntervalRef.current = null;
    }
  }, []);

  const clearTimers = useCallback(() => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
  }, []);

  const schedule = useCallback((fn: () => void, ms: number) => {
    const id = setTimeout(fn, ms);
    timersRef.current.push(id);
  }, []);

  const runStream = useCallback(
    (fromTokens: number, toTokens: number, onComplete: () => void) => {
      clearStreamInterval();
      let count = fromTokens;
      setRevealedTokens(count);

      streamIntervalRef.current = setInterval(() => {
        count += 1;
        setRevealedTokens(count);

        if (count >= toTokens) {
          clearStreamInterval();
          onComplete();
        }
      }, TOKEN_MS);
    },
    [clearStreamInterval]
  );

  const resetLoop = useCallback(() => {
    clearStreamInterval();
    clearTimers();
    loopActiveRef.current = false;
    setPhase("idle");
    setRevealedTokens(0);
  }, [clearStreamInterval, clearTimers]);

  const startLoop = useCallback(() => {
    if (loopActiveRef.current) return;
    loopActiveRef.current = true;

    setPhase("idle");
    setRevealedTokens(0);

    schedule(() => {
      setPhase("streaming1");
      runStream(0, breakpoint, () => {
        setPhase("refreshFlash");
        schedule(() => {
          setPhase("resumedHold");
          schedule(() => {
            setPhase("streaming2");
            runStream(breakpoint, TOKENS.length, () => {
              setPhase("completeHold");
              schedule(() => {
                loopActiveRef.current = false;
                startLoop();
              }, COMPLETE_HOLD_MS);
            });
          }, RESUMED_HOLD_MS);
        }, REFRESH_MS);
      });
    }, IDLE_MS);
  }, [breakpoint, runStream, schedule]);

  useEffect(() => {
    const node = rootRef.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      ([entry]) => setInView(entry.isIntersecting),
      { threshold: 0.25 }
    );
    observer.observe(node);

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!inView || reduce) {
      resetLoop();
      return;
    }

    startLoop();

    return () => {
      resetLoop();
    };
  }, [inView, reduce, resetLoop, startLoop]);

  const visibleText = tokensToText(revealedTokens);
  const isStreaming = phase === "streaming1" || phase === "streaming2";
  const isReconnecting = phase === "refreshFlash";
  const isResumedBeat = phase === "resumedHold";
  const isComplete = phase === "completeHold";
  const showCursor = isStreaming;

  const messageTone =
    isComplete || isStreaming ? "text-foreground" : "text-muted-foreground";

  if (reduce) {
    return (
      <div
        ref={rootRef}
        aria-label={ARIA_LABEL}
        className={cn(
          "flex h-full min-h-[13rem] flex-col justify-center p-4 sm:min-h-[15rem] sm:p-5",
          className
        )}
        role="img"
      >
        <p className={cn(sectionLabel, "mb-3")}>Thread reply</p>
        <div className={cn(card, "rounded-lg p-4")}>
          <p className={cn(TEXT_SLOT_CLASS, "text-foreground")}>{MESSAGE}</p>
          <p className="mt-3 text-xs text-muted-foreground/75">Stream resumed</p>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={rootRef}
      aria-label={ARIA_LABEL}
      className={cn(
        "flex h-full min-h-[13rem] flex-col justify-center p-4 sm:min-h-[15rem] sm:p-5",
        className
      )}
      role="img"
    >
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <p className={sectionLabel}>Thread reply</p>
        {isStreaming ? (
          <ShinyText
            as="span"
            className="text-xs font-light tracking-wide text-muted-foreground/80"
            speed={1.2}
            text="Writing…"
          />
        ) : isComplete ? (
          <span className="text-xs font-light tracking-wide text-muted-foreground/60">
            Complete
          </span>
        ) : (
          <span aria-hidden className="text-xs opacity-0">
            —
          </span>
        )}
      </div>

      <div className={cn(card, "rounded-lg p-4 sm:p-5")}>
        <div className={cn("relative", TEXT_SLOT_CLASS)}>
          <p aria-hidden className="invisible">
            {MESSAGE}
          </p>
          <div className="absolute inset-0">
            <p className={cn(messageTone, "transition-colors duration-500")}>
              {visibleText}
              {showCursor ? (
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
        </div>

        <div
          className={cn(
            "mt-3 min-h-[2.25rem] pt-3",
            (isReconnecting || isResumedBeat) && "border-t border-border/40"
          )}
        >
          <AnimatePresence mode="wait">
            {isReconnecting ? (
              <motion.div
                key="reconnecting"
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-2 text-xs text-muted-foreground/80"
                exit={{ opacity: 0, y: -2 }}
                initial={{ opacity: 0, y: 4 }}
                transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
              >
                <Loader className="text-muted-foreground/70" size={14} />
                <span>Reconnecting..</span>
              </motion.div>
            ) : isResumedBeat ? (
              <motion.p
                key="resumed"
                animate={{ opacity: 1, y: 0 }}
                className="text-xs text-muted-foreground/75"
                exit={{ opacity: 0 }}
                initial={{ opacity: 0, y: 2 }}
                transition={{ duration: 0.2 }}
              >
                Stream resumed
              </motion.p>
            ) : null}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
