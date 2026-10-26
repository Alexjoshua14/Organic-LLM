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

/**
 * Proposal glyph alphabets for the session-glyphs sandbox lab.
 * Chat and Arcadia always share one mark (constraint from design research).
 * Production motion CSS (sg-*) is reused so working / live / new read for real.
 */

export type ProposalId = "instrument" | "mass" | "alphabet";

export type ProposalExperience =
  | "chat"
  | "speak"
  | "rabbitHole"
  | "strata"
  | "remy"
  | "noesis"
  | "introspection"
  | "other";

/** Experiences shown in proposal grids. Arcadia collapses into chat. */
export const PROPOSAL_EXPERIENCES: {
  id: ProposalExperience;
  label: string;
  note?: string;
}[] = [
  { id: "chat", label: "Chat / Arcadia", note: "Shared · dialogue bubble" },
  { id: "speak", label: "Speak", note: "Waveform" },
  { id: "rabbitHole", label: "Rabbit hole", note: "Idea branching" },
  { id: "strata", label: "Strata", note: "Lines converging" },
  { id: "remy", label: "Remy", note: "Stovetop · 2 on" },
  { id: "noesis", label: "Noesis", note: "Topic spark" },
  { id: "introspection", label: "Introspection", note: "Inward mirror" },
  { id: "other", label: "Other", note: "Fallback diamond" },
];

export const PROPOSALS: {
  id: ProposalId;
  title: string;
  pitch: string;
}[] = [
  {
    id: "instrument",
    title: "Instrument",
    pitch:
      "TE / Nothing weight: equal ink, round caps, one clear silhouette each. Closest to the existing motion idioms.",
  },
  {
    id: "mass",
    title: "Mass",
    pitch:
      "Preferred direction: speech-bubble chat (shared with Arcadia), waveform speak, branching rabbit hole, converging strata, stove Remy, spark Noesis, inward-mirror introspection. Tiny fills for 14px idle weight.",
  },
  {
    id: "alphabet",
    title: "Alphabet",
    pitch:
      "Maximum outer-contour difference — circle, bars, tree, strata stack, plate, lens, split square, diamond.",
  },
];

const GLYPH_TIMING = {
  "--sg-cycle": `${SESSION_GLYPH_CYCLE_S}s`,
  "--sg-level-cycle": `${SESSION_GLYPH_LEVEL_CYCLE_S}s`,
  "--sg-stagger": `${SESSION_GLYPH_CASCADE_STAGGER_S}s`,
  "--sg-settle": `${SESSION_SIGNAL_SETTLE_S}s`,
} as CSSProperties;

const at = (i: number) => ({ "--sg-i": i }) as CSSProperties;

type PartState = "done" | "current" | "pending";

function partState(stepIndex: number, part: number): PartState | undefined {
  if (stepIndex < 0) return undefined;
  if (part < stepIndex) return "done";

  return part === stepIndex ? "current" : "pending";
}

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

function instrument(experience: ProposalExperience, stepIndex: number): ReactNode {
  switch (experience) {
    case "chat":
      return <SweepRing r={5.25} />;
    case "speak":
      return (
        <>
          <path className="sg-bar" d="M4 7v2" style={at(0)} />
          <path className="sg-bar" d="M6.5 5v6" style={at(1)} />
          <path className="sg-bar" d="M9.5 5v6" style={at(2)} />
          <path className="sg-bar" d="M12 7v2" style={at(3)} />
        </>
      );
    case "rabbitHole":
      return (
        <>
          <path className="sg-part" d="M8 13.5V9" data-state={partState(stepIndex, 0)} />
          <circle className="sg-part" cx="8" cy="7.5" data-state={partState(stepIndex, 1)} r="1.75" />
          <path
            className="sg-part"
            d="M8 5.75V4M5.5 4.5 3.5 2.75M10.5 4.5 12.5 2.75"
            data-state={partState(stepIndex, 2)}
          />
        </>
      );
    case "strata":
      return (
        <>
          <path className="sg-cell" d="M2.5 4.5h8" style={at(0)} />
          <path className="sg-cell" d="M5.5 8h8" style={at(1)} />
          <path className="sg-cell" d="M2.5 11.5h8" style={at(2)} />
        </>
      );
    case "remy":
      return (
        <>
          <rect className="sg-cell" height="5" rx="1.25" style={at(0)} width="5" x="2.5" y="2.5" />
          <rect className="sg-cell" height="5" rx="1.25" style={at(1)} width="5" x="8.5" y="2.5" />
          <rect className="sg-cell" height="5" rx="1.25" style={at(2)} width="5" x="2.5" y="8.5" />
          <rect className="sg-cell" height="5" rx="1.25" style={at(3)} width="5" x="8.5" y="8.5" />
        </>
      );
    case "noesis":
      return (
        <>
          <circle className="sg-base" cx="8" cy="8" r="5.25" />
          <circle className="sg-sweep" cx="8" cy="8" pathLength={100} r="5.25" transform="rotate(-90 8 8)" />
          <circle className="sg-base" cx="8" cy="8" r="1.5" />
        </>
      );
    case "introspection":
      return (
        <>
          <rect className="sg-base" height="10.5" rx="1" width="10.5" x="2.75" y="2.75" />
          <path className="sg-sweep" d="M2.75 8h10.5" pathLength={100} />
        </>
      );
    case "other":
      return <path className="sg-breathe" d="M8 2.75 13.25 8 8 13.25 2.75 8Z" />;
  }
}

/** Speech-bubble outline — sweep travels this path. Shared by Chat + Arcadia. */
const CHAT_BUBBLE =
  "M3.25 4.25h8.25a1.75 1.75 0 0 1 1.75 1.75v4a1.75 1.75 0 0 1-1.75 1.75H7.1L4.6 13.6V11.75H3.25A1.75 1.75 0 0 1 1.5 10V6a1.75 1.75 0 0 1 1.75-1.75Z";

/** Soft orbit for Noesis sweep — exploration circling a topic spark. */
const NOESIS_ORBIT = "M8 2.75a5.25 5.25 0 1 1-4.55 2.625";

/** Mirror glass arc for Introspection sweep — looking inward at the self-dot. */
const INTROSPECTION_MIRROR = "M10.75 3.25a4.75 4.75 0 0 1 0 9.5";

function mass(experience: ProposalExperience, stepIndex: number): ReactNode {
  switch (experience) {
    case "chat":
      // Dialogue, not a bare ring: bubble outline carries sweep; two message dashes = mass.
      return (
        <>
          <path className="sg-base" d={CHAT_BUBBLE} />
          <path className="sg-sweep" d={CHAT_BUBBLE} pathLength={100} />
          <path className="sg-base" d="M4.75 6.5h5.5" strokeWidth={1.5} />
          <path className="sg-base" d="M4.75 8.85h3.75" strokeWidth={1.5} />
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
      // Three seams converging to one join — layers coming together, not parallel strata only.
      return (
        <>
          <path className="sg-cell" d="M2.5 3.75 13.25 8" style={at(0)} strokeWidth={1.6} />
          <path className="sg-cell" d="M2.5 8h10.75" style={at(1)} strokeWidth={1.6} />
          <path className="sg-cell" d="M2.5 12.25 13.25 8" style={at(2)} strokeWidth={1.6} />
          <circle className="sg-cell" cx="13.25" cy="8" fill="currentColor" r="1.15" stroke="none" style={at(1)} />
        </>
      );
    case "remy":
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
          <rect className="sg-cell" height="4.5" rx="1" style={at(1)} width="4.5" x="8.75" y="2.75" />
          <rect className="sg-cell" height="4.5" rx="1" style={at(2)} width="4.5" x="2.75" y="8.75" />
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
    case "noesis":
      // Topic spark: filled core + rays (explore outward). Partial orbit carries the sweep.
      // Deliberately not a ring+dot — that read as "chat cousin."
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
      // Mirror glass on the right; filled self-dot on the left — review looking inward.
      return (
        <>
          <path className="sg-base" d={INTROSPECTION_MIRROR} />
          <path className="sg-sweep" d={INTROSPECTION_MIRROR} pathLength={100} />
          <path className="sg-base" d="M10.75 3.25v9.5" />
          <circle className="sg-base" cx="5.5" cy="8" fill="currentColor" r="1.85" stroke="none" />
        </>
      );
    case "other":
      return (
        <path className="sg-breathe" d="M8 2.75 13.25 8 8 13.25 2.75 8Z" fill="currentColor" fillOpacity={0.22} />
      );
  }
}

function alphabet(experience: ProposalExperience, stepIndex: number): ReactNode {
  switch (experience) {
    case "chat":
      return <SweepRing r={5.5} />;
    case "speak":
      return (
        <>
          <path className="sg-bar" d="M5.5 11.5V6.5a2.5 2.5 0 0 1 5 0v5" />
          <path className="sg-bar" d="M4 11.5h8" style={at(0)} />
          <path className="sg-bar" d="M8 11.5v1.75" style={at(1)} />
        </>
      );
    case "rabbitHole":
      return (
        <>
          <path className="sg-part" d="M8 14V8.5" data-state={partState(stepIndex, 0)} />
          <circle className="sg-part" cx="8" cy="7" data-state={partState(stepIndex, 1)} r="2" />
          <path className="sg-part" d="M8 5 4.5 2.5M8 5 11.5 2.5" data-state={partState(stepIndex, 2)} />
          <path className="sg-part" d="M8 5 8 2.5" data-state={partState(stepIndex, 2)} />
        </>
      );
    case "strata":
      return (
        <>
          <path className="sg-cell" d="M3 3.5h10" style={at(0)} />
          <path className="sg-cell" d="M3 8h10" style={at(1)} />
          <path className="sg-cell" d="M3 12.5h10" style={at(2)} />
          <path className="sg-cell" d="M5 3.5v9" style={at(1)} opacity={0.45} />
        </>
      );
    case "remy":
      return (
        <>
          <ellipse className="sg-cell" cx="8" cy="8" rx="5.5" ry="4" style={at(0)} />
          <path className="sg-cell" d="M4 8h8" style={at(1)} />
          <path className="sg-cell" d="M8 5.5v5" style={at(2)} />
        </>
      );
    case "noesis":
      return (
        <>
          <ellipse className="sg-base" cx="8" cy="8" rx="6" ry="3.75" />
          <circle className="sg-sweep" cx="8" cy="8" pathLength={100} r="1.75" />
          <circle className="sg-base" cx="8" cy="8" r="1.75" />
        </>
      );
    case "introspection":
      return (
        <>
          <rect className="sg-base" height="10" rx="0.5" width="10" x="3" y="3" />
          <path className="sg-base" d="M3 8h10M8 3v10" />
        </>
      );
    case "other":
      return <path className="sg-breathe" d="M8 2.5 13.5 8 8 13.5 2.5 8Z" />;
  }
}

function shapeFor(
  proposal: ProposalId,
  experience: ProposalExperience,
  stepIndex: number
): ReactNode {
  switch (proposal) {
    case "instrument":
      return instrument(experience, stepIndex);
    case "mass":
      return mass(experience, stepIndex);
    case "alphabet":
      return alphabet(experience, stepIndex);
  }
}

/** Map proposal experience → production motion idiom for CSS. */
function motionFor(experience: ProposalExperience) {
  if (experience === "chat") return SESSION_EXPERIENCES.chat.motion;

  return SESSION_EXPERIENCES[experience as SessionExperience].motion;
}

export type ProposalGlyphProps = {
  proposal: ProposalId;
  experience: ProposalExperience;
  signal: SessionSignal;
  emphasized?: boolean;
  /** Override render size; default matches production 14px. */
  className?: string;
  strokeWidth?: number;
};

export function ProposalGlyph({
  proposal,
  experience,
  signal,
  emphasized,
  className,
  strokeWidth = 1.25,
}: ProposalGlyphProps) {
  const step = signal.kind === "working" ? signal.step : null;

  return (
    <svg
      aria-hidden="true"
      className={cn("session-glyph size-3.5 shrink-0", className)}
      data-emphasized={emphasized || undefined}
      data-experience={experience === "chat" ? "chat" : experience}
      data-motion={motionFor(experience)}
      data-proposal={proposal}
      data-signal={signal.kind}
      data-step={step ?? undefined}
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={strokeWidth}
      style={GLYPH_TIMING}
      viewBox="0 0 16 16"
    >
      {shapeFor(proposal, experience, rabbitHoleStepIndex(step))}
    </svg>
  );
}
