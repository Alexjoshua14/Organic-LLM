"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Loader2, Sparkles } from "lucide-react";

import { glass } from "@/components/design-system/primitives";
import { usePageVisible } from "@/components/hooks/use-page-visible";
import { useWelcomeInView } from "@/components/pages/welcome/use-welcome-in-view";
import { welcomeDemoCompactClass } from "@/components/pages/welcome/welcome-demo-user-message";
import ShinyText from "@/components/ShinyText";
import { card, sectionLabel } from "@/lib/rabbit-holes/designTokens";
import {
  WELCOME_STRATA_ELABORATED_BULLETS,
  WELCOME_STRATA_ELABORATED_CLOSING,
  WELCOME_STRATA_ELABORATED_FULL,
  WELCOME_STRATA_ELABORATED_HEADING,
  WELCOME_STRATA_ELABORATED_LEAD,
  WELCOME_STRATA_GENERATE_LABEL,
  WELCOME_STRATA_GENERATING_LABEL,
  WELCOME_STRATA_PAGE_TITLE,
  WELCOME_STRATA_RAW_FRAGMENTS,
  WELCOME_STRATA_REFINED_TEXT,
  WELCOME_STRATA_REFINED_TITLE,
  WELCOME_STRATA_TABS,
} from "@/lib/welcome/strata-fixtures";
import { cn } from "@/lib/utils";

type WelcomeStrataIllustrationProps = {
  className?: string;
};

type Phase = "raw" | "generating" | "refined" | "synthesis" | "hold";
type ActiveTab = "source" | "synthesis";

const RAW_HOLD_MS = 1800;
const GENERATING_MS = 950;
const REFINED_HOLD_MS = 2200;
const SYNTHESIS_STREAM_MS = 38;
const SYNTHESIS_HOLD_MS = 3200;
const RESET_MS = 500;

const VIEW_TRANSITION = { duration: 0.32, ease: [0.22, 1, 0.36, 1] as const };

const ARIA_LABEL =
  "Strata refines messy draft notes into polished prose, then elaborates them into editorial sections on an AI-assisted canvas.";

function tokens(text: string): string[] {
  return text.match(/\S+\s*/g) ?? [text];
}

function RawNotes({ lines }: { lines: readonly string[] }) {
  return (
    <div className="space-y-1">
      {lines.map((line) => (
        <p key={line} className="font-mono text-[10px] leading-snug text-foreground/78">
          {line}
        </p>
      ))}
    </div>
  );
}

function RefinedPreview({ visible }: { visible: boolean }) {
  return (
    <AnimatePresence initial={false}>
      {visible ? (
        <motion.div
          key="refined"
          animate={{ opacity: 1, y: 0 }}
          className="mt-1.5 border-t border-border/40 pt-1.5"
          exit={{ opacity: 0, y: 4 }}
          initial={{ opacity: 0, y: 6 }}
          transition={VIEW_TRANSITION}
        >
          <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground/75">
            {WELCOME_STRATA_REFINED_TITLE}
          </p>
          <p className="mt-1 text-[10px] leading-snug text-foreground/88 sm:text-xs">
            {WELCOME_STRATA_REFINED_TEXT}
          </p>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

function ElaboratedCard({
  heading = "",
  lead = "",
  bullets = [],
  closing = "",
  streamingText,
  streaming,
}: {
  heading?: string;
  lead?: string;
  bullets?: readonly string[];
  closing?: string;
  streamingText?: string;
  streaming?: boolean;
}) {
  if (streamingText !== undefined) {
    return (
      <div
        className={cn(
          "flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg px-2 py-1.5 sm:px-2.5 sm:py-2",
          glass({ tone: "brown", opaque: true }),
          "border border-border/60"
        )}
      >
        <p className="whitespace-pre-line text-[10px] leading-snug text-foreground/90 sm:text-xs">
          {streamingText}
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
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex min-h-0 flex-1 flex-col gap-1 overflow-hidden rounded-lg px-2 py-1.5 sm:px-2.5 sm:py-2",
        glass({ tone: "brown", opaque: true }),
        "border border-border/60"
      )}
    >
      <p className="text-[10px] font-medium leading-snug text-foreground sm:text-xs">{heading}</p>
      <p className="text-[10px] leading-snug text-foreground/88 sm:text-xs">{lead}</p>
      <ul className="mt-0.5 space-y-0.5">
        {bullets.map((item) => (
          <li key={item} className="text-[10px] leading-snug text-foreground/82 sm:text-xs">
            • {item}
          </li>
        ))}
      </ul>
      <p className="mt-1 text-[10px] leading-snug text-muted-foreground/75">{closing}</p>
    </div>
  );
}

function StrataChrome({
  activeTab,
  isGenerating,
  showGenerateStrip,
}: {
  activeTab: ActiveTab;
  isGenerating: boolean;
  showGenerateStrip: boolean;
}) {
  return (
    <div className="shrink-0 space-y-1.5 border-t border-border/40 px-2 py-1.5 sm:px-2.5 sm:py-2">
      <AnimatePresence initial={false}>
        {showGenerateStrip ? (
          <motion.div
            key="generate"
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center justify-between gap-2"
            exit={{ opacity: 0, y: 4 }}
            initial={{ opacity: 0, y: -4 }}
            transition={VIEW_TRANSITION}
          >
            <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground/70">
              <Sparkles className="size-3" strokeWidth={1.75} />
              AI-assisted
            </span>
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-semibold",
                isGenerating
                  ? "border border-border/60 bg-muted/40 text-muted-foreground"
                  : "bg-foreground text-background"
              )}
            >
              {isGenerating ? (
                <>
                  <Loader2 className="size-3 animate-spin" strokeWidth={1.75} />
                  {WELCOME_STRATA_GENERATING_LABEL}
                </>
              ) : (
                WELCOME_STRATA_GENERATE_LABEL
              )}
            </span>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <div
        className={cn(
          glass({ opaque: true }),
          "inline-flex w-full justify-center gap-0.5 rounded-full border border-border/70 p-0.5"
        )}
        role="tablist"
        aria-label="Strata sections"
      >
        {WELCOME_STRATA_TABS.map((tab) => (
          <span
            key={tab.id}
            aria-selected={tab.id === activeTab}
            className={cn(
              "rounded-full px-2.5 py-1 text-[10px] font-medium transition-colors",
              tab.id === activeTab ? "bg-foreground text-background" : "text-muted-foreground/70"
            )}
            role="tab"
          >
            {tab.label}
          </span>
        ))}
      </div>
    </div>
  );
}

export function WelcomeStrataIllustration({ className }: WelcomeStrataIllustrationProps) {
  const reduce = useReducedMotion();
  const pageVisible = usePageVisible();
  const rootRef = useRef<HTMLDivElement>(null);
  const inView = useWelcomeInView(rootRef);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const streamRafRef = useRef<number | null>(null);
  const loopActiveRef = useRef(false);

  const [phase, setPhase] = useState<Phase>("raw");
  const [activeTab, setActiveTab] = useState<ActiveTab>("source");
  const [elaboratedText, setElaboratedText] = useState("");
  const [streamingElaborated, setStreamingElaborated] = useState(false);

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

  const schedule = useCallback((fn: () => void, ms: number) => {
    const id = setTimeout(fn, ms);

    timersRef.current.push(id);
  }, []);

  const resetLoop = useCallback(() => {
    loopActiveRef.current = false;
    clearTimers();
    clearStreamRaf();
    setPhase("raw");
    setActiveTab("source");
    setElaboratedText("");
    setStreamingElaborated(false);
  }, [clearStreamRaf, clearTimers]);

  const streamElaborated = useCallback(
    (onComplete: () => void) => {
      clearStreamRaf();
      setElaboratedText("");
      setStreamingElaborated(true);

      const parts = tokens(WELCOME_STRATA_ELABORATED_FULL);
      const start = performance.now();

      const tick = (now: number) => {
        const count = Math.min(parts.length, Math.floor((now - start) / SYNTHESIS_STREAM_MS));

        setElaboratedText(parts.slice(0, count).join(""));

        if (count < parts.length) {
          streamRafRef.current = requestAnimationFrame(tick);

          return;
        }

        setStreamingElaborated(false);
        onComplete();
      };

      streamRafRef.current = requestAnimationFrame(tick);
    },
    [clearStreamRaf]
  );

  const startLoop = useCallback(() => {
    if (loopActiveRef.current) return;
    loopActiveRef.current = true;

    const runCycle = () => {
      setPhase("raw");
      setActiveTab("source");
      setElaboratedText("");
      setStreamingElaborated(false);

      schedule(() => {
        setPhase("generating");

        schedule(() => {
          setPhase("refined");

          schedule(() => {
            setActiveTab("synthesis");
            setPhase("synthesis");

            schedule(() => {
              streamElaborated(() => {
                setPhase("hold");

                schedule(() => {
                  loopActiveRef.current = false;
                  schedule(() => startLoop(), RESET_MS);
                }, SYNTHESIS_HOLD_MS);
              });
            }, 320);
          }, REFINED_HOLD_MS);
        }, GENERATING_MS);
      }, RAW_HOLD_MS);
    };

    runCycle();
  }, [schedule, streamElaborated]);

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

  const frameClass = cn(
    "flex h-full min-h-0 flex-col justify-start px-2 py-2 sm:px-2.5 sm:py-2.5",
    className
  );

  const showRefined = phase === "refined" || phase === "synthesis" || phase === "hold";
  const showGenerateStrip = activeTab === "source";
  const isGenerating = phase === "generating";
  const showSource = activeTab === "source";
  const showSynthesis = activeTab === "synthesis";

  if (reduce) {
    return (
      <div ref={rootRef} aria-label={ARIA_LABEL} className={frameClass} role="img">
        <div className="mb-1 shrink-0 text-center">
          <p className={sectionLabel}>Editorial canvas</p>
          <p className="mt-0.5 font-commissioner text-[11px] font-light tracking-tight text-foreground">
            {WELCOME_STRATA_PAGE_TITLE}
          </p>
        </div>

        <div
          className={cn(
            card,
            "flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg",
            welcomeDemoCompactClass
          )}
        >
          <div className="flex min-h-0 flex-1 flex-col gap-1 px-2 py-2 sm:px-2.5 sm:py-2">
            <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground/75">
              Source
            </p>
            <div className="min-h-0 flex-1 overflow-hidden rounded-md border border-border/55 bg-background/45 px-2 py-1">
              <RawNotes lines={WELCOME_STRATA_RAW_FRAGMENTS} />
              <RefinedPreview visible />
            </div>
          </div>

          <StrataChrome activeTab="source" isGenerating={false} showGenerateStrip />
        </div>
      </div>
    );
  }

  return (
    <div ref={rootRef} aria-label={ARIA_LABEL} className={frameClass} role="img">
      <div className="mb-1 shrink-0 text-center">
        <p className={sectionLabel}>Editorial canvas</p>
        <p className="mt-0.5 font-commissioner text-[11px] font-light tracking-tight text-foreground">
          {WELCOME_STRATA_PAGE_TITLE}
        </p>
      </div>

      <div
        className={cn(
          card,
          "flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg",
          welcomeDemoCompactClass
        )}
      >
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-2 py-2 sm:px-2.5 sm:py-2">
          <AnimatePresence initial={false} mode="wait">
            {showSource ? (
              <motion.div
                key="source"
                animate={{ opacity: 1, y: 0 }}
                className="flex min-h-0 flex-1 flex-col"
                exit={{ opacity: 0, y: -4 }}
                initial={{ opacity: 0, y: 6 }}
                transition={VIEW_TRANSITION}
              >
                <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground/75">
                  Raw notes
                </p>
                <div className="min-h-0 flex-1 overflow-y-auto rounded-md border border-border/55 bg-background/45 px-2 py-1">
                  <RawNotes lines={WELCOME_STRATA_RAW_FRAGMENTS} />
                  <RefinedPreview visible={showRefined} />
                </div>
              </motion.div>
            ) : showSynthesis ? (
              <motion.div
                key="synthesis"
                animate={{ opacity: 1, y: 0 }}
                className="flex min-h-0 flex-1 flex-col"
                exit={{ opacity: 0, y: -4 }}
                initial={{ opacity: 0, y: 6 }}
                transition={VIEW_TRANSITION}
              >
                <div className="mb-1 flex items-center justify-between gap-2">
                  <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground/75">
                    Elaborated
                  </p>
                  {streamingElaborated || elaboratedText.length === 0 ? (
                    <ShinyText
                      as="span"
                      className="text-[10px] font-light text-muted-foreground/75"
                      speed={0.85}
                      text="Writing…"
                    />
                  ) : null}
                </div>
                <ElaboratedCard streaming={streamingElaborated} streamingText={elaboratedText} />
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>

        <StrataChrome
          activeTab={activeTab}
          isGenerating={isGenerating}
          showGenerateStrip={showGenerateStrip}
        />
      </div>
    </div>
  );
}
