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

const ARCH = "M3.5 13.5V8a4.5 4.5 0 0 1 9 0v5.5";

function shape(experience: SessionExperience, stepIndex: number): ReactNode {
  switch (experience) {
    case "chat":
      return <SweepRing />;
    case "arcadia":
      // Chat's lab variant: a different container, not a different mark (subway circle vs diamond).
      return (
        <>
          <path className="sg-base" d={ARCH} />
          <path className="sg-sweep" d={ARCH} pathLength={100} />
          <circle className="sg-base" cx="8" cy="10" r="1.5" />
        </>
      );
    case "noesis":
      return (
        <>
          <SweepRing />
          <circle className="sg-base" cx="8" cy="8" r="2" />
        </>
      );
    case "introspection":
      return (
        <>
          <SweepRing />
          <path className="sg-base" d="M8 3v10" />
        </>
      );
    case "speak":
      return (
        <>
          <path className="sg-bar" d="M4.5 6.5v3" style={at(0)} />
          <path className="sg-bar" d="M8 4v8" style={at(1)} />
          <path className="sg-bar" d="M11.5 5.5v5" style={at(2)} />
        </>
      );
    case "rabbitHole":
      // Parts in generation order: stem = sources, node = article, forks = branch suggestions.
      return (
        <>
          <path className="sg-part" d="M8 14V9.5" data-state={partState(stepIndex, 0)} />
          <circle className="sg-part" cx="8" cy="8" data-state={partState(stepIndex, 1)} r="1.5" />
          <path
            className="sg-part"
            d="M6.9 6.9 4 4M9.1 6.9 12 4"
            data-state={partState(stepIndex, 2)}
          />
        </>
      );
    case "strata":
      return (
        <>
          <path className="sg-cell" d="M3 5h8" style={at(0)} />
          <path className="sg-cell" d="M5 8h8" style={at(1)} />
          <path className="sg-cell" d="M3 11h8" style={at(2)} />
        </>
      );
    case "remy":
      return (
        <>
          <rect className="sg-cell" height="4" rx="1" style={at(0)} width="4" x="3" y="3" />
          <rect className="sg-cell" height="4" rx="1" style={at(1)} width="4" x="9" y="3" />
          <rect className="sg-cell" height="4" rx="1" style={at(3)} width="4" x="9" y="9" />
          <rect className="sg-cell" height="4" rx="1" style={at(2)} width="4" x="3" y="9" />
        </>
      );
    case "other":
      return <path className="sg-breathe" d="M8 3.5 12.5 8 8 12.5 3.5 8Z" />;
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
      {shape(experience, rabbitHoleStepIndex(step))}
    </svg>
  );
}
