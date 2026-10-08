"use client";

import { Mic } from "lucide-react";

import { RESURFACE_RIBBON_HEIGHT, RESURFACE_RIBBON_WIDTH } from "./resurface-layout";

import { VOICE_WAVE_STROKE_WIDTH } from "@/components/voice/voice-live-bar-timing";
import { buildRibbonCurves, toSmoothPath } from "@/lib/speak/waveform-geometry";
import { cn } from "@/lib/utils";

/** The live ribbon's resting shape, frozen at t=0 with silence on every driver. */
const RIBBON_PATHS = buildRibbonCurves(
  { volume: 0, treble: 0, bass: 0 },
  0,
  RESURFACE_RIBBON_HEIGHT,
  1
).map((curve) => ({
  d: toSmoothPath(curve.ys, RESURFACE_RIBBON_WIDTH),
  opacity: curve.opacity,
}));

/**
 * A narrow, inert echo of the live voice bar that starts a call about one thought.
 *
 * It borrows the ribbon so it reads as "voice", but it must never read as *live*: the real bar is
 * the only thing on screen saying the mic is open. So the ribbon is still, there is no lumen dot
 * and no clock, and the mic icon says "start", not "on". The glass is the card's; a second glass
 * material stacked inside it would read as neither.
 */
export function ResurfaceVoiceStart({
  label,
  pending = false,
  onStart,
}: {
  /** What the call is about, for the accessible name. */
  label: string;
  pending?: boolean;
  onStart: () => void;
}) {
  return (
    <button
      aria-busy={pending || undefined}
      aria-label={`Talk about “${label}” by voice`}
      className={cn(
        "relative flex h-5 w-16 shrink-0 items-center gap-1 rounded-full px-1.5",
        "bg-foreground/[0.04] text-muted-foreground ring-1 ring-inset ring-foreground/10",
        "transition-colors hover:bg-foreground/[0.08] hover:text-foreground",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50",
        "disabled:cursor-default",
        pending && "animate-pulse motion-reduce:animate-none"
      )}
      data-resurface-voice-start=""
      disabled={pending}
      title="Talk about this by voice"
      type="button"
      onClick={onStart}
    >
      <Mic aria-hidden="true" className="size-3 shrink-0" />
      <svg
        aria-hidden="true"
        className="h-full min-w-0 flex-1"
        preserveAspectRatio="none"
        viewBox={`0 0 ${RESURFACE_RIBBON_WIDTH} ${RESURFACE_RIBBON_HEIGHT}`}
      >
        <g fill="none" stroke="currentColor">
          {RIBBON_PATHS.map((path, i) => (
            <path
              key={i}
              d={path.d}
              strokeLinecap="round"
              strokeOpacity={path.opacity}
              strokeWidth={VOICE_WAVE_STROKE_WIDTH * 1.5}
              vectorEffect="non-scaling-stroke"
            />
          ))}
        </g>
      </svg>
    </button>
  );
}
