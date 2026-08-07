"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";

import { ChatThinking } from "@/components/chat/chat-loading";
import { ProcessingTextBurn } from "@/components/chat/processing-text-burn";
import ShinyText from "@/components/ShinyText";
import { glass } from "@/components/design-system/primitives";
import { Button } from "@/components/third-party/ui/button";
import { cn } from "@/lib/utils";

const USER_PROMPT = "What are white holes?";

const PROCESSING_SEQUENCE = [
  "Gathering context on white holes...",
  "Searching memories for white holes...",
  "Searching the web...",
  "Looking up white holes and general relativity...",
  "Writing up the answer...",
] as const;

const STATE_CYCLE_MS = 2800;
/** Pause after a full sequence before the next loop (assistant row unmounts briefly). */
const REST_BETWEEN_LOOPS_MS = 1400;

function UserBubble({ text }: { text: string }) {
  return (
    <div className="flex justify-end">
      <div
        className={cn(
          "max-w-[85%] rounded-2xl rounded-br-md px-4 py-2.5 text-sm text-foreground",
          glass({ opaque: true })
        )}
      >
        {text}
      </div>
    </div>
  );
}

function AssistantProcessingBubble({
  label,
  variant,
}: {
  label: string;
  variant: "current" | "burn";
}) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.div
      animate={{ opacity: 1, y: 0, scale: 1 }}
      className="group/ai-message rounded-lg p-4 flex flex-col gap-2"
      initial={reduceMotion ? false : { opacity: 0, y: 8, scale: 0.98 }}
      transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="ai-message text-foreground max-w-full">
        {variant === "current" ? (
          <ShinyText disabled={false} speed={1.2} text={label} />
        ) : (
          <ChatThinking text={label} />
        )}
      </div>
    </motion.div>
  );
}

function ProcessingThreadColumn({
  title,
  variant,
  active,
  label,
}: {
  title: string;
  variant: "current" | "burn";
  active: boolean;
  label: string;
}) {
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-3">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{title}</p>
      <div
        className={cn(
          "flex min-h-[18rem] flex-col gap-6 rounded-xl border border-border/50 p-4",
          glass({ opaque: true })
        )}
      >
        <UserBubble text={USER_PROMPT} />
        {active ? <AssistantProcessingBubble label={label} variant={variant} /> : null}
      </div>
    </div>
  );
}

export function ProcessingTailDemo() {
  const reduceMotion = useReducedMotion();
  const scrollRef = useRef<HTMLDivElement>(null);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const loopingRef = useRef(true);
  const [paused, setPaused] = useState(false);
  const [running, setRunning] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);

  const clearTimers = useCallback(() => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
  }, []);

  const schedule = useCallback((fn: () => void, ms: number) => {
    const id = setTimeout(fn, ms);

    timersRef.current.push(id);
  }, []);

  const scrollToTail = useCallback(() => {
    const node = scrollRef.current;

    if (!node) return;

    requestAnimationFrame(() => {
      node.scrollTo({ top: node.scrollHeight, behavior: reduceMotion ? "auto" : "smooth" });
    });
  }, [reduceMotion]);

  const stop = useCallback(() => {
    loopingRef.current = false;
    clearTimers();
    setPaused(true);
    setRunning(false);
    setStepIndex(0);
  }, [clearTimers]);

  const runIteration = useCallback(() => {
    if (!loopingRef.current) return;

    clearTimers();
    setRunning(true);
    setStepIndex(0);
    schedule(scrollToTail, 80);

    PROCESSING_SEQUENCE.forEach((_, index) => {
      if (index === 0) return;

      schedule(() => {
        setStepIndex(index);
        scrollToTail();
      }, index * STATE_CYCLE_MS);
    });

    const sequenceEndMs = PROCESSING_SEQUENCE.length * STATE_CYCLE_MS;

    schedule(() => {
      if (!loopingRef.current) return;
      setRunning(false);
    }, sequenceEndMs);

    schedule(() => {
      if (!loopingRef.current) return;
      runIteration();
    }, sequenceEndMs + REST_BETWEEN_LOOPS_MS);
  }, [clearTimers, schedule, scrollToTail]);

  const resume = useCallback(() => {
    loopingRef.current = true;
    setPaused(false);
    runIteration();
  }, [runIteration]);

  useEffect(() => {
    loopingRef.current = true;
    setPaused(false);
    runIteration();

    return () => {
      loopingRef.current = false;
      clearTimers();
    };
  }, [clearTimers, runIteration]);

  const label = PROCESSING_SEQUENCE[stepIndex] ?? PROCESSING_SEQUENCE[0];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <Button disabled={paused} type="button" variant="outline" onClick={stop}>
          Pause
        </Button>
        <Button disabled={!paused} type="button" onClick={resume}>
          Resume loop
        </Button>
        <p className="text-xs text-muted-foreground">
          Loops automatically: cycles processing labels every {(STATE_CYCLE_MS / 1000).toFixed(1)}s, rests{" "}
          {(REST_BETWEEN_LOOPS_MS / 1000).toFixed(1)}s, then replays.
        </p>
      </div>

      <div ref={scrollRef} className="max-h-[28rem] overflow-y-auto rounded-xl border border-border/40">
        <div className="grid gap-4 p-4 lg:grid-cols-2">
          <ProcessingThreadColumn
            active={running}
            label={label}
            title="Legacy — ShinyText"
            variant="current"
          />
          <ProcessingThreadColumn
            active={running}
            label={label}
            title="Production — ChatThinking (ProcessingTextBurn)"
            variant="burn"
          />
        </div>
      </div>

      <div className="rounded-lg border border-border/40 bg-background-tertiary/20 px-4 py-3 text-xs text-muted-foreground leading-relaxed">
        <p className="font-medium text-foreground">Timing reference</p>
        <ul className="mt-2 list-disc space-y-1 pl-4">
          <li>Outgoing: opacity 1→0, scale 1→0.9, translate (−2px, +2px), 25ms/char stagger</li>
          <li>
            Incoming: 150ms initial delay, 30ms/char stagger, opposing text
            (--primary-foreground) → accent → primary
          </li>
          <li>Incoming opacity: 0.8→1.0 over 250ms; per-char color pulse 80ms</li>
          <li>Char 0 gap ≈ 0.07s; char 1 ≈ 0.16s; char 2 ≈ 0.16s (incoming start minus outgoing start)</li>
        </ul>
      </div>

      <StateBlock label="Isolated burn transitions (auto-loop)">
        <IsolatedBurnPlayground />
      </StateBlock>
    </div>
  );
}

function StateBlock({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="mb-3 text-sm font-medium text-muted-foreground uppercase tracking-wide">
        {label}
      </h3>
      <div className={cn("rounded-lg p-4 shadow-md", glass())}>{children}</div>
    </section>
  );
}

function IsolatedBurnPlayground() {
  const [index, setIndex] = useState(0);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const loopingRef = useRef(true);
  const labels = PROCESSING_SEQUENCE;

  const clearTimers = useCallback(() => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
  }, []);

  const scheduleStep = useCallback(
    (nextIndex: number, delayMs: number) => {
      const id = setTimeout(() => {
        if (!loopingRef.current) return;
        setIndex(nextIndex);
        const followingIndex = (nextIndex + 1) % labels.length;
        const rest =
          nextIndex === labels.length - 1 ? REST_BETWEEN_LOOPS_MS + STATE_CYCLE_MS : STATE_CYCLE_MS;
        scheduleStep(followingIndex, rest);
      }, delayMs);

      timersRef.current.push(id);
    },
    [labels.length]
  );

  useEffect(() => {
    loopingRef.current = true;
    scheduleStep(1, STATE_CYCLE_MS);

    return () => {
      loopingRef.current = false;
      clearTimers();
    };
  }, [clearTimers, scheduleStep]);

  return (
    <div className="space-y-4">
      <ProcessingTextBurn text={labels[index] ?? labels[0]} />
      <div className="flex flex-wrap gap-2">
        {labels.map((item, itemIndex) => (
          <Button
            key={item}
            size="sm"
            type="button"
            variant={itemIndex === index ? "default" : "outline"}
            onClick={() => setIndex(itemIndex)}
          >
            {itemIndex + 1}
          </Button>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        Auto-advances through all labels; longer pause before wrapping to step 1.
      </p>
    </div>
  );
}
