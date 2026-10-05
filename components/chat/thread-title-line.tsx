"use client";

import { useEffect, useRef, type CSSProperties, type ReactNode } from "react";
import { useReducedMotion } from "framer-motion";

import { processingTextBurnSwapDurationMs } from "@/lib/chat/processing-text-burn-timing";
import {
  completeTitleRegen,
  useTitleRegenSession,
  type TitleRegenSession,
} from "@/lib/chat/title-regen-store";
import { cn } from "@/lib/utils";

import "@/styles/ProcessingTextBurn.css";
import "@/styles/ShinyText.css";
import "@/styles/ThreadTitleLine.css";

export type ThreadTitlePhase = "stable" | "shimmer" | "burn";

type ThreadTitleLineProps = {
  phase: ThreadTitlePhase;
  text: string;
  from?: string;
  to?: string;
  className?: string;
};

function tokenize(value: string): string[] {
  return value.split(/(\s+)/).filter((token) => token.length > 0);
}

function renderChars(text: string, side: "out" | "in", charClassName: string): ReactNode {
  let charIndex = 0;

  return tokenize(text).map((token, tokenIndex) => {
    if (/^\s+$/.test(token)) {
      const start = charIndex;

      charIndex += token.length;

      return (
        <span key={`${side}-ws-${tokenIndex}`} className="processing-text-burn__space">
          {Array.from(token).map((char, index) => (
            <span
              key={`${side}-ws-${tokenIndex}-${index}`}
              className={cn("processing-text-burn__char", charClassName)}
              style={{ "--ptb-i": start + index } as CSSProperties}
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
      <span key={`${side}-word-${tokenIndex}`} className="processing-text-burn__word">
        {chars.map((char, index) => (
          <span
            key={`${side}-ch-${start + index}`}
            className={cn("processing-text-burn__char", charClassName)}
            style={{ "--ptb-i": start + index } as CSSProperties}
          >
            {char}
          </span>
        ))}
      </span>
    );
  });
}

export function threadTitlePhase(
  session: TitleRegenSession | null,
  reduceMotion: boolean
): ThreadTitlePhase {
  if (!session) return "stable";
  if (!session.nextTitle || session.nextTitle === session.baseTitle || reduceMotion) return "shimmer";

  return "burn";
}

/**
 * One line box for a thread title.
 * Stable and shimmer share the same text node; burn swaps glyphs inside that box.
 */
export function ThreadTitleLine({ phase, text, from, to, className }: ThreadTitleLineProps) {
  const burning = phase === "burn" && from != null && to != null && from !== to;

  return (
    <span
      aria-hidden
      className={cn(
        "thread-title-line",
        phase === "shimmer" && "thread-title-line--shimmer",
        burning && "processing-text-burn thread-title-line--burn",
        phase === "stable" && className
      )}
      data-title={phase === "shimmer" ? text : undefined}
    >
      {burning ? (
        <>
          <span className="processing-text-burn__layer processing-text-burn__layer--outgoing">
            {renderChars(from, "out", "processing-text-burn__char--outgoing")}
          </span>
          <span className="processing-text-burn__layer">
            {renderChars(to, "in", "processing-text-burn__char--incoming")}
          </span>
        </>
      ) : (
        text
      )}
    </span>
  );
}

export function useThreadTitlePhase(threadId: string | undefined, title: string) {
  const session = useTitleRegenSession(threadId);
  const reduceMotion = useReducedMotion() === true;
  const landedRef = useRef<string | null>(null);

  if (session?.nextTitle) {
    landedRef.current = session.nextTitle;
  } else if (landedRef.current && title === landedRef.current) {
    landedRef.current = null;
  }

  const phase = threadTitlePhase(session, reduceMotion);
  const shown = session
    ? reduceMotion && session.nextTitle
      ? session.nextTitle
      : session.baseTitle
    : (landedRef.current ?? title);
  const announced = phase === "burn" && session?.nextTitle ? session.nextTitle : shown;

  useEffect(() => {
    if (!threadId || !session?.nextTitle) return;

    const next = session.nextTitle;
    const same = next === session.baseTitle;
    const ms =
      reduceMotion || same ? 0 : processingTextBurnSwapDurationMs(session.baseTitle, next);
    const timeout = window.setTimeout(() => completeTitleRegen(threadId), ms);

    return () => window.clearTimeout(timeout);
  }, [reduceMotion, session, threadId]);

  return {
    phase,
    shown,
    announced,
    from: session?.baseTitle,
    to: session?.nextTitle,
  };
}
