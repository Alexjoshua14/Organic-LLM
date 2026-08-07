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
}: ProcessingTextBurnProps) {
  const reduceMotion = useReducedMotion();
  const prevTextRef = useRef(text);
  const [transition, setTransition] = useState<{
    outgoing: string;
    incoming: string;
    key: number;
  } | null>(null);
  const [settled, setSettled] = useState(false);

  useEffect(() => {
    if (reduceMotion) {
      prevTextRef.current = text;
      setTransition(null);
      setSettled(true);

      return;
    }

    const previous = prevTextRef.current;

    if (previous === text) {
      setSettled(false);
      const timeout = window.setTimeout(() => setSettled(true), initialEnterDurationMs(text));

      return () => window.clearTimeout(timeout);
    }

    prevTextRef.current = text;
    setSettled(false);
    setTransition({ outgoing: previous, incoming: text, key: Date.now() });

    const timeout = window.setTimeout(() => {
      setTransition(null);
      setSettled(true);
    }, transitionDurationMs(previous, text));

    return () => window.clearTimeout(timeout);
  }, [reduceMotion, text]);

  if (reduceMotion) {
    return <Component className={className}>{text}</Component>;
  }

  const showSustainShimmer = sustainShimmer && settled && transition == null;
  const outgoing = transition?.outgoing;
  const incoming = transition?.incoming ?? text;
  const animKey = transition?.key ?? 0;
  const incomingClass = outgoing
    ? "processing-text-burn__char--incoming"
    : "processing-text-burn__char--incoming-initial";

  return (
    <Component className={cn("processing-text-burn", className)} aria-live="polite">
      <span className="sr-only">{text}</span>
      {showSustainShimmer ? (
        <span aria-hidden className="processing-text-burn__layer processing-text-burn__sustain-host">
          <ShinyText as="span" speed={shimmerSpeed} text={text} />
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
