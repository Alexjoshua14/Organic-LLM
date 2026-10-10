"use client";

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { useReducedMotion } from "framer-motion";

import {
  PROCESSING_TEXT_BURN_CHAR_DURATION_S,
  PROCESSING_TEXT_BURN_IN_INITIAL_DELAY_S,
  PROCESSING_TEXT_BURN_IN_OPACITY_DURATION_S,
  PROCESSING_TEXT_BURN_IN_STAGGER_S,
  PROCESSING_TEXT_BURN_OUT_STAGGER_S,
  PROCESSING_TEXT_BURN_SUSTAIN_SHIMMER_S,
} from "@/lib/chat/processing-text-burn-timing";
import { cn } from "@/lib/utils";
import ShinyText from "@/components/ShinyText";

import "@/styles/ProcessingTextBurn.css";

const OUT_STAGGER_MS = PROCESSING_TEXT_BURN_OUT_STAGGER_S * 1000;
const IN_STAGGER_MS = PROCESSING_TEXT_BURN_IN_STAGGER_S * 1000;
const IN_INITIAL_DELAY_MS = PROCESSING_TEXT_BURN_IN_INITIAL_DELAY_S * 1000;
const CHAR_DURATION_MS = PROCESSING_TEXT_BURN_CHAR_DURATION_S * 1000;
const IN_OPACITY_DURATION_MS = PROCESSING_TEXT_BURN_IN_OPACITY_DURATION_S * 1000;

const DEFAULT_SUSTAIN_SHIMMER_SPEED_S = PROCESSING_TEXT_BURN_SUSTAIN_SHIMMER_S;

export type ProcessingTextBurnProps = {
  text: string;
  className?: string;
  as?: "p" | "span";
  /**
   * After burn-in settles, keep a subtle shimmer so in-flight status still feels alive.
   * Defaults on — loading/tool labels are activity indicators.
   */
  sustainShimmer?: boolean;
  /** Sustain shimmer loop duration in seconds (lower = faster). */
  shimmerSpeed?: number;
  /**
   * While set, re-run a burn sweep on the current display text every N seconds.
   * Shimmer sustains between sweeps. Text changes while looping are deferred to the
   * next sweep boundary so title swaps stay on the loop cadence.
   */
  loopSweepIntervalS?: number | null;
  /**
   * When true with an active loop, the next sweep boundary applies any deferred text
   * (or ends the loop if text is unchanged) and then calls `onCommitSweepSettled`.
   */
  commitOnNextSweep?: boolean;
  /** Fires after a commit sweep has burned in and settled (or immediately if text was unchanged). */
  onCommitSweepSettled?: () => void;
};

function transitionDurationMs(outgoing: string, incoming: string): number {
  const outgoingMs = outgoing.length * OUT_STAGGER_MS + CHAR_DURATION_MS;
  const incomingMs =
    IN_INITIAL_DELAY_MS + Math.max(0, incoming.length - 1) * IN_STAGGER_MS + IN_OPACITY_DURATION_MS;

  return Math.max(outgoingMs, incomingMs) + 60;
}

/** Initial mount uses `--incoming-initial` (no in-delay). */
function initialEnterDurationMs(text: string): number {
  return Math.max(0, text.length - 1) * IN_STAGGER_MS + IN_OPACITY_DURATION_MS + 60;
}

/** Split into words + whitespace tokens so words never wrap mid-glyph. */
function tokenize(value: string): string[] {
  return value.split(/(\s+)/).filter((token) => token.length > 0);
}

function renderLayer(
  text: string,
  charClassName: string,
  animKey: number,
  side: "out" | "in"
): ReactNode {
  let charIndex = 0;

  return tokenize(text).map((token, tokenIndex) => {
    if (/^\s+$/.test(token)) {
      const start = charIndex;

      charIndex += token.length;

      return (
        <span key={`${animKey}-${side}-ws-${tokenIndex}`} className="processing-text-burn__space">
          {Array.from(token).map((char, i) => (
            <span
              key={`${animKey}-${side}-ws-${tokenIndex}-${i}`}
              className={cn("processing-text-burn__char", charClassName)}
              style={{ "--ptb-i": start + i } as CSSProperties}
            >
              {char}
            </span>
          ))}
        </span>
      );
    }

    const start = charIndex;
    const chars = Array.from(token);

    charIndex += chars.length;

    return (
      <span key={`${animKey}-${side}-word-${tokenIndex}`} className="processing-text-burn__word">
        {chars.map((char, i) => (
          <span
            key={`${animKey}-${side}-ch-${start + i}`}
            className={cn("processing-text-burn__char", charClassName)}
            style={{ "--ptb-i": start + i } as CSSProperties}
          >
            {char}
          </span>
        ))}
      </span>
    );
  });
}

/** Character-level burn transition between processing-state labels. */
export function ProcessingTextBurn({
  text,
  className,
  as: Component = "p",
  sustainShimmer = true,
  shimmerSpeed = DEFAULT_SUSTAIN_SHIMMER_SPEED_S,
  loopSweepIntervalS = null,
  commitOnNextSweep = false,
  onCommitSweepSettled,
}: ProcessingTextBurnProps) {
  const reduceMotion = useReducedMotion();
  const [displayText, setDisplayText] = useState(text);
  const prevTextRef = useRef(displayText);
  const [transition, setTransition] = useState<{
    outgoing: string;
    incoming: string;
    key: number;
  } | null>(null);
  const [settled, setSettled] = useState(false);
  const [sweepKey, setSweepKey] = useState(0);
  const pendingTextRef = useRef<string | null>(null);
  const commitPendingRef = useRef(false);
  const commitStartedRef = useRef(false);
  const commitAfterSettleRef = useRef(false);
  const onCommitRef = useRef(onCommitSweepSettled);
  const transitionBusyRef = useRef(false);

  onCommitRef.current = onCommitSweepSettled;
  commitPendingRef.current = commitOnNextSweep;

  const isLooping =
    !reduceMotion &&
    loopSweepIntervalS != null &&
    Number.isFinite(loopSweepIntervalS) &&
    loopSweepIntervalS > 0;

  useEffect(() => {
    if (!commitOnNextSweep) {
      commitStartedRef.current = false;
    }
  }, [commitOnNextSweep]);

  // Queue text changes while looping so swaps land on the next sweep boundary.
  useEffect(() => {
    if (text === displayText) {
      if (!commitOnNextSweep) {
        pendingTextRef.current = null;
      }

      return;
    }

    if (isLooping) {
      pendingTextRef.current = text;

      return;
    }

    pendingTextRef.current = null;
    setDisplayText(text);
  }, [text, displayText, isLooping, commitOnNextSweep]);

  // If looping stops with a queued title, apply it immediately.
  useEffect(() => {
    if (isLooping) return;
    const pending = pendingTextRef.current;

    if (pending == null || pending === displayText) return;
    pendingTextRef.current = null;
    setDisplayText(pending);
  }, [isLooping, displayText]);

  useEffect(() => {
    if (reduceMotion) {
      prevTextRef.current = displayText;
      setTransition(null);
      setSettled(true);
      transitionBusyRef.current = false;
      if (commitAfterSettleRef.current) {
        commitAfterSettleRef.current = false;
        onCommitRef.current?.();
      }

      return;
    }

    const previous = prevTextRef.current;

    if (previous === displayText) {
      setSettled(false);
      transitionBusyRef.current = true;
      const timeout = window.setTimeout(() => {
        setSettled(true);
        transitionBusyRef.current = false;
        if (commitAfterSettleRef.current) {
          commitAfterSettleRef.current = false;
          onCommitRef.current?.();
        }
      }, initialEnterDurationMs(displayText));

      return () => window.clearTimeout(timeout);
    }

    prevTextRef.current = displayText;
    setSettled(false);
    transitionBusyRef.current = true;
    setTransition({ outgoing: previous, incoming: displayText, key: Date.now() });

    const timeout = window.setTimeout(
      () => {
        setTransition(null);
        setSettled(true);
        transitionBusyRef.current = false;
        if (commitAfterSettleRef.current) {
          commitAfterSettleRef.current = false;
          onCommitRef.current?.();
        }
      },
      transitionDurationMs(previous, displayText)
    );

    return () => window.clearTimeout(timeout);
  }, [reduceMotion, displayText, sweepKey]);

  // Cadence: self-sweep, or commit deferred text / end loop on the next boundary.
  useEffect(() => {
    if (!isLooping || loopSweepIntervalS == null) return;

    const id = window.setInterval(() => {
      if (transitionBusyRef.current) return;

      const pending = pendingTextRef.current;
      const shouldCommit = commitPendingRef.current;

      if (shouldCommit) {
        if (commitStartedRef.current) return;
        commitStartedRef.current = true;
        commitAfterSettleRef.current = true;

        if (pending != null && pending !== prevTextRef.current) {
          pendingTextRef.current = null;
          setDisplayText(pending);
        } else {
          pendingTextRef.current = null;
          // Same title: one final self-sweep, then settle → onCommit.
          setSweepKey(Date.now());
        }

        return;
      }

      // Self-sweep: remount incoming-initial on the same text.
      setSweepKey(Date.now());
    }, loopSweepIntervalS * 1000);

    return () => window.clearInterval(id);
  }, [isLooping, loopSweepIntervalS]);

  if (reduceMotion) {
    return <Component className={className}>{displayText}</Component>;
  }

  const showSustainShimmer = sustainShimmer && settled && transition == null;
  const outgoing = transition?.outgoing;
  const incoming = transition?.incoming ?? displayText;
  const animKey = transition?.key ?? sweepKey;
  const incomingClass = outgoing
    ? "processing-text-burn__char--incoming"
    : "processing-text-burn__char--incoming-initial";

  return (
    <Component className={cn("processing-text-burn", className)} aria-live="polite">
      <span className="sr-only">{displayText}</span>
      {showSustainShimmer ? (
        <span
          aria-hidden
          className="processing-text-burn__layer processing-text-burn__sustain-host"
        >
          <ShinyText as="span" speed={shimmerSpeed} text={displayText} />
        </span>
      ) : (
        <>
          {outgoing ? (
            <span
              key={`out-${animKey}`}
              aria-hidden
              className="processing-text-burn__layer processing-text-burn__layer--outgoing"
            >
              {renderLayer(outgoing, "processing-text-burn__char--outgoing", animKey, "out")}
            </span>
          ) : null}
          <span key={`in-${animKey}`} aria-hidden className="processing-text-burn__layer">
            {renderLayer(incoming, incomingClass, animKey, "in")}
          </span>
        </>
      )}
    </Component>
  );
}
