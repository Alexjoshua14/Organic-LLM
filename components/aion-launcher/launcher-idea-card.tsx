"use client";

import { forwardRef } from "react";
import { motion, useReducedMotion } from "framer-motion";

import { SessionGlyph } from "@/components/sidebar/session-glyph";
import { homeComposerGlassSurface } from "@/components/design-system/primitives";
import { formatIdeaAge, type LauncherIdea } from "@/lib/launcher/launcher-ideas";
import { LAUNCHER_CARD_ENTER_S, LAUNCHER_CARD_STAGGER_S } from "@/lib/launcher/launcher-timing";
import { getSessionExperience, SESSION_EXPERIENCES } from "@/lib/sidebar/session-experience";
import {
  describeSessionSignal,
  sessionSignalStatusText,
  type SessionSignal,
} from "@/lib/sidebar/session-signal";
import { cn } from "@/lib/utils";

type LauncherIdeaCardProps = {
  idea: LauncherIdea;
  /** Position in the grid; staggers the entrance. */
  index: number;
  signal: SessionSignal;
  /** The best match for what is typed. A step in value, never the accent (accent means new). */
  likely: boolean;
  now: number;
  /** Roving tabindex: only one card is in the tab order at a time. */
  tabbable: boolean;
  onOpen: (idea: LauncherIdea) => void;
  onFocusCard: (index: number) => void;
};

/**
 * One recent idea: what it is, where you left off, and whether something is happening in it.
 * Signals follow docs/design/sidebar-session-signals.md — lights out when idle, one signal at
 * a time, accent only for "new".
 */
export const LauncherIdeaCard = forwardRef<HTMLButtonElement, LauncherIdeaCardProps>(
  function LauncherIdeaCard(
    { idea, index, signal, likely, now, tabbable, onOpen, onFocusCard },
    ref
  ) {
    const reduceMotion = useReducedMotion();
    const experience = getSessionExperience(idea.feature);
    const experienceLabel = SESSION_EXPERIENCES[experience].label;
    const status = sessionSignalStatusText(signal);
    const isNew = signal.kind === "new";
    const age = formatIdeaAge(idea.date, now);

    return (
      <motion.button
        ref={ref}
        animate={{ opacity: 1, y: 0 }}
        data-launcher-card=""
        data-likely={likely || undefined}
        data-session-signal={signal.kind}
        initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 8 }}
        tabIndex={tabbable ? 0 : -1}
        transition={{
          duration: LAUNCHER_CARD_ENTER_S,
          ease: [0.25, 0.1, 0.25, 1],
          delay: index * LAUNCHER_CARD_STAGGER_S,
        }}
        type="button"
        className={cn(
          homeComposerGlassSurface,
          "group flex h-full min-h-[7.25rem] w-full cursor-pointer flex-col items-start gap-2 p-3 text-left outline-none",
          "transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5",
          "motion-reduce:transition-none motion-reduce:hover:translate-y-0",
          "focus-visible:ring-2 focus-visible:ring-foreground/40",
          "data-[likely]:ring-1 data-[likely]:ring-foreground/25"
        )}
        onClick={() => onOpen(idea)}
        onFocus={() => onFocusCard(index)}
      >
        <span className="flex w-full items-center gap-1.5 text-[11px] leading-none text-muted-foreground">
          <SessionGlyph
            className={cn(isNew && "text-accent")}
            experience={experience}
            signal={signal}
          />
          {status ? <span className="truncate">{status}</span> : null}
          {isNew ? <span className="truncate text-accent">New</span> : null}
          {age ? <span className="ml-auto shrink-0 tabular-nums">{age}</span> : null}
        </span>
        <span
          className={cn(
            "line-clamp-2 text-sm leading-snug tracking-tight",
            isNew ? "font-semibold text-foreground" : "font-medium text-foreground"
          )}
        >
          {idea.title}
        </span>
        {/* Reserved height: the cue arrives after the card, and must not move it. */}
        <span
          className={cn(
            "line-clamp-2 min-h-8 text-xs leading-4 text-muted-foreground",
            "transition-opacity duration-200 motion-reduce:transition-none",
            idea.cue ? "opacity-100" : "opacity-0"
          )}
        >
          {idea.cue ?? ""}
        </span>
        <span className="sr-only">{describeSessionSignal(experienceLabel, signal)}</span>
      </motion.button>
    );
  }
);
