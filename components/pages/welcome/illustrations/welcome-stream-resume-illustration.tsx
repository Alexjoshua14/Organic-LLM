"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";

import { usePageVisible } from "@/components/hooks/use-page-visible";
import { useWelcomeInView } from "@/components/pages/welcome/use-welcome-in-view";
import { welcomeDemoCompactClass } from "@/components/pages/welcome/welcome-demo-user-message";
import ShinyText from "@/components/ShinyText";
import { card, sectionLabel } from "@/lib/rabbit-holes/designTokens";
import { cn } from "@/lib/utils";

type WelcomeStreamResumeIllustrationProps = {
  className?: string;
};

type Phase = "idle" | "streaming1" | "refreshFlash" | "resumedHold" | "streaming2" | "completeHold";

const MESSAGE =
  "If memory is episodic, tool choice should leave fingerprints across a thread — tracing which retrieval calls ran before the model answered, and whether that pattern repeats on the next turn.";

const TOKENS = MESSAGE.match(/\S+\s*/g) ?? [MESSAGE];
const BREAKPOINT_TOKEN = TOKENS.findIndex((token) => token.trimStart().startsWith("tracing"));

const TOKEN_MS = 50;
const IDLE_MS = 700;
const REFRESH_MS = 2400;
const RESUMED_HOLD_MS = 550;
const COMPLETE_HOLD_MS = 2600;

const TEXT_SLOT_CLASS = "text-[10px] leading-snug";

const ARIA_LABEL =
  "Assistant reply streaming in a thread, reconnecting after a refresh, then continuing the same server-side stream from the prior partial text.";

function tokensToText(tokenCount: number): string {
  return TOKENS.slice(0, tokenCount).join("");
}

export function WelcomeStreamResumeIllustration({
  className,
}: WelcomeStreamResumeIllustrationProps) {
  const reduce = useReducedMotion();
  const pageVisible = usePageVisible();
  const rootRef = useRef<HTMLDivElement>(null);
  const inView = useWelcomeInView(rootRef);
  const streamRafRef = useRef<number | null>(null);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const loopActiveRef = useRef(false);

  const [phase, setPhase] = useState<Phase>("idle");
  const [revealedTokens, setRevealedTokens] = useState(0);

  const breakpoint = useMemo(
    () => (BREAKPOINT_TOKEN >= 0 ? BREAKPOINT_TOKEN : Math.floor(TOKENS.length * 0.55)),
    []
  );

  const clearStreamRaf = useCallback(() => {
    if (streamRafRef.current !== null) {
      cancelAnimationFrame(streamRafRef.current);
      streamRafRef.current = null;
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
      clearStreamRaf();
      const startTime = performance.now();

      setRevealedTokens(fromTokens);

      const tick = (now: number) => {
        const elapsed = now - startTime;
        const count = Math.min(toTokens, fromTokens + Math.floor(elapsed / TOKEN_MS));

        setRevealedTokens(count);

        if (count >= toTokens) {
          clearStreamRaf();
          onComplete();

          return;
        }

        streamRafRef.current = requestAnimationFrame(tick);
      };

      streamRafRef.current = requestAnimationFrame(tick);
    },
    [clearStreamRaf]
  );

  const resetLoop = useCallback(() => {
    clearStreamRaf();
    clearTimers();
    loopActiveRef.current = false;
    setPhase("idle");
    setRevealedTokens(0);
  }, [clearStreamRaf, clearTimers]);

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

  const visibleText = tokensToText(revealedTokens);
  const isStreaming = phase === "streaming1" || phase === "streaming2";
  const isReconnecting = phase === "refreshFlash";
  const isResumedBeat = phase === "resumedHold";
  const isComplete = phase === "completeHold";
  const showCursor = isStreaming;

  const messageTone = isComplete || isStreaming ? "text-foreground" : "text-muted-foreground";

  if (reduce) {
    return (
      <div
        ref={rootRef}
        aria-label={ARIA_LABEL}
        className={cn(
          "flex h-full min-h-0 flex-col justify-center px-2.5 py-1.5 sm:px-3 sm:py-2",
          className
        )}
        role="img"
      >
        <div className="mb-1.5 flex w-full items-baseline justify-between gap-3">
          <p className={sectionLabel}>Resumable stream</p>
          <span className="text-[10px] text-muted-foreground/75">Stream resumed</span>
        </div>
        <div className={cn(card, "w-full rounded-lg px-2.5 py-2 sm:px-3 sm:py-2", welcomeDemoCompactClass)}>
          <p className={cn(TEXT_SLOT_CLASS, "text-foreground")}>{MESSAGE}</p>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={rootRef}
      aria-label={ARIA_LABEL}
      className={cn(
        "flex h-full min-h-0 flex-col justify-center px-2.5 py-1.5 sm:px-3 sm:py-2",
        className
      )}
      role="img"
    >
      <div className="mb-1.5 flex w-full items-baseline justify-between gap-3">
        <p className={sectionLabel}>Resumable stream</p>
        {isStreaming ? (
          <ShinyText
            as="span"
            className="text-[10px] font-light tracking-wide text-muted-foreground/80"
            speed={1.2}
            text="Writing…"
          />
        ) : isComplete ? (
          <span className="text-[10px] font-light tracking-wide text-muted-foreground/60">
            Complete
          </span>
        ) : isReconnecting ? (
          <ShinyText
            as="span"
            className="text-[10px] font-light tracking-wide text-muted-foreground/80"
            speed={0.9}
            text="Reconnecting…"
          />
        ) : isResumedBeat ? (
          <span className="text-[10px] font-light tracking-wide text-muted-foreground/75">
            Stream resumed
          </span>
        ) : (
          <span aria-hidden className="text-[10px] opacity-0">
            —
          </span>
        )}
      </div>

      <div className={cn(card, "w-full rounded-lg px-2.5 py-2 sm:px-3 sm:py-2", welcomeDemoCompactClass)}>
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
      </div>
    </div>
  );
}
