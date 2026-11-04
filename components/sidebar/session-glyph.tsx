import type { CSSProperties, ReactNode } from "react";
import type { SessionExperience } from "@/lib/sidebar/session-experience";
import type { SessionSignal } from "@/lib/sidebar/session-signal";

import { SESSION_EXPERIENCES } from "@/lib/sidebar/session-experience";
import { rabbitHoleStepIndex } from "@/lib/sidebar/session-signal";
import {
  SESSION_GLYPH_CASCADE_STAGGER_S,
  SESSION_GLYPH_CYCLE_S,
  SESSION_GLYPH_LEVEL_CYCLE_S,
  SESSION_SIGNAL_SETTLE_S,
} from "@/lib/sidebar/session-signal-timing";
import { cn } from "@/lib/utils";

import "@/styles/SessionGlyph.css";

const GLYPH_TIMING = {
  "--sg-cycle": `${SESSION_GLYPH_CYCLE_S}s`,
  "--sg-level-cycle": `${SESSION_GLYPH_LEVEL_CYCLE_S}s`,
  "--sg-stagger": `${SESSION_GLYPH_CASCADE_STAGGER_S}s`,
  "--sg-settle": `${SESSION_SIGNAL_SETTLE_S}s`,
} as CSSProperties;

/** Index for staggered idioms (cascade, level), read by the CSS as `--sg-i`. */
const at = (i: number) => ({ "--sg-i": i }) as CSSProperties;

type PartState = "done" | "current" | "pending";

function partState(stepIndex: number, part: number): PartState | undefined {
  if (stepIndex < 0) return undefined;
  if (part < stepIndex) return "done";

  return part === stepIndex ? "current" : "pending";
}

/** A ring the sweep can travel; starts at twelve o'clock. */
function SweepRing({ r = 5 }: { r?: number }) {
  return (
    <>
      <circle className="sg-base" cx="8" cy="8" r={r} />
      <circle
        className="sg-sweep"
        cx="8"
        cy="8"
        pathLength={100}
        r={r}
        transform="rotate(-90 8 8)"
      />
    </>
  );
}

/** Soft orbit for the Noesis sweep: exploration circling a topic spark. */
const NOESIS_ORBIT = "M8 2.75a5.25 5.25 0 1 1-4.55 2.625";

/** Mirror glass arc for the Introspection sweep: looking inward at the self-dot. */
const INTROSPECTION_MIRROR = "M10.75 3.25a4.75 4.75 0 0 1 0 9.5";

/**
 * Chat and Arcadia are the unmarked default: the glyph slot stays empty unless something is
 * happening, when a thin ring is only an annunciator for working / new, not an identity mark.
 */
function chatAnnunciator(signalKind: SessionSignal["kind"]): ReactNode {
  if (signalKind === "idle" || signalKind === "paused" || signalKind === "live") return null;

  return <SweepRing />;
}

/** The glyph's drawing for one experience; exported so the sandbox lab can render it directly. */
export function sessionGlyphShape(
  experience: SessionExperience,
  stepIndex: number,
  signalKind: SessionSignal["kind"]
): ReactNode {
  switch (experience) {
    case "chat":
    case "arcadia":
      return chatAnnunciator(signalKind);
    case "noesis":
      // Topic spark: filled core + rays, with a partial orbit carrying the sweep.
      return (
        <>
          <path className="sg-base" d={NOESIS_ORBIT} />
          <path className="sg-sweep" d={NOESIS_ORBIT} pathLength={100} />
          <path
            className="sg-base"
            d="M8 4.6v1.35M8 10.05v1.35M4.6 8h1.35M10.05 8h1.35M5.55 5.55l.95.95M9.5 9.5l.95.95M9.5 5.55l-.95.95M5.55 9.5l.95-.95"
          />
          <circle className="sg-base" cx="8" cy="8" fill="currentColor" r="1.55" stroke="none" />
        </>
      );
    case "introspection":
      return (
        <>
          <path className="sg-base" d={INTROSPECTION_MIRROR} />
          <path className="sg-sweep" d={INTROSPECTION_MIRROR} pathLength={100} />
          <path className="sg-base" d="M10.75 3.25v9.5" />
          <circle className="sg-base" cx="5.5" cy="8" fill="currentColor" r="1.85" stroke="none" />
        </>
      );
    case "speak":
      return (
        <>
          <rect
            className="sg-bar"
            fill="currentColor"
            height="3"
            rx="0.75"
            stroke="none"
            style={at(0)}
            width="1.5"
            x="3.25"
            y="6.5"
          />
          <rect
            className="sg-bar"
            fill="currentColor"
            height="7"
            rx="0.75"
            stroke="none"
            style={at(1)}
            width="1.5"
            x="5.75"
            y="4.5"
          />
          <rect
            className="sg-bar"
            fill="currentColor"
            height="7"
            rx="0.75"
            stroke="none"
            style={at(2)}
            width="1.5"
            x="8.75"
            y="4.5"
          />
          <rect
            className="sg-bar"
            fill="currentColor"
            height="3"
            rx="0.75"
            stroke="none"
            style={at(3)}
            width="1.5"
            x="11.25"
            y="6.5"
          />
        </>
      );
    case "rabbitHole":
      // Parts in generation order: stem = sources, node = article, forks = branch suggestions.
      return (
        <>
          <path className="sg-part" d="M8 13.5V9" data-state={partState(stepIndex, 0)} />
          <circle
            className="sg-part"
            cx="8"
            cy="7.5"
            data-state={partState(stepIndex, 1)}
            fill="currentColor"
            r="1.9"
            stroke="none"
          />
          <path
            className="sg-part"
            d="M8 5.6V3.75M5.25 4.4 3.25 2.5M10.75 4.4 12.75 2.5"
            data-state={partState(stepIndex, 2)}
          />
        </>
      );
    case "strata":
      return (
        <>
          <path className="sg-cell" d="M2.5 4h9" strokeWidth={1.75} style={at(0)} />
          <path className="sg-cell" d="M4.5 8h9" strokeWidth={1.75} style={at(1)} />
          <path className="sg-cell" d="M2.5 12h9" strokeWidth={1.75} style={at(2)} />
        </>
      );
    case "remy":
      // Stovetop: two burners on, two off.
      return (
        <>
          <rect
            className="sg-cell"
            fill="currentColor"
            height="4.5"
            rx="1"
            stroke="none"
            style={at(0)}
            width="4.5"
            x="2.75"
            y="2.75"
          />
          <rect
            className="sg-cell"
            height="4.5"
            rx="1"
            style={at(1)}
            width="4.5"
            x="8.75"
            y="2.75"
          />
          <rect
            className="sg-cell"
            height="4.5"
            rx="1"
            style={at(2)}
            width="4.5"
            x="2.75"
            y="8.75"
          />
          <rect
            className="sg-cell"
            fill="currentColor"
            height="4.5"
            rx="1"
            stroke="none"
            style={at(3)}
            width="4.5"
            x="8.75"
            y="8.75"
          />
        </>
      );
    case "other":
      return (
        <path
          className="sg-breathe"
          d="M8 2.75 13.25 8 8 13.25 2.75 8Z"
          fill="currentColor"
          fillOpacity={0.22}
        />
      );
  }
}

export type SessionGlyphProps = {
  experience: SessionExperience;
  signal: SessionSignal;
  /** The thread on screen: full value, so the eye finds where it is. */
  emphasized?: boolean;
  className?: string;
};

/**
 * A session's type mark and live state in one 14px glyph. Every mark is drawn on the same
 * 16-unit grid with one stroke weight so the set reads as a family. The glyph is decorative;
 * the row carries the same information as text for assistive tech.
 */
export function SessionGlyph({ experience, signal, emphasized, className }: SessionGlyphProps) {
  const step = signal.kind === "working" ? signal.step : null;

  return (
    <svg
      aria-hidden="true"
      className={cn("session-glyph size-3.5 shrink-0", className)}
      data-emphasized={emphasized || undefined}
      data-experience={experience}
      data-motion={SESSION_EXPERIENCES[experience].motion}
      data-signal={signal.kind}
      data-step={step ?? undefined}
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.25}
      style={GLYPH_TIMING}
      viewBox="0 0 16 16"
    >
      {sessionGlyphShape(experience, rabbitHoleStepIndex(step), signal.kind)}
    </svg>
  );
}
