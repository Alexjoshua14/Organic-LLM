"use client";

import { useEffect } from "react";
import { animate, motion, useMotionValue, useReducedMotion, useTransform } from "framer-motion";

/**
 * Time each knob takes to slide between its closed and open positions. Inside Material's
 * 250-400ms enter band at its low end, so it reads as a gesture without making the click feel
 * like a wait; closing uses the same time so open and close mirror each other.
 */
const KNOB_SLIDE_S = 0.24;
/** Each track starts this long after the one above, so the knobs settle one after another. */
const KNOB_STAGGER_S = 0.04;
const KNOB_EASE = [0.25, 0.46, 0.45, 0.94] as const;

/**
 * The sliders-horizontal glyph drawn as three tracks, each a left segment, a knob and a right
 * segment. The closed positions are the Lucide icon's own, so at rest it looks the same. Opening
 * slides each knob by `shift` (user units) along its track, and the track segments follow so the
 * gap beside each knob keeps its width.
 *
 * - `left` / `right`: where the left segment ends and the right one starts, closed.
 * - `shift`: knob travel when the panel is open; alternating directions keep it balanced.
 */
const TRACKS = [
  { y: 5, knob: 14, left: 10, right: 14, shift: -5 },
  { y: 12, knob: 8, left: 8, right: 12, shift: 6 },
  { y: 19, knob: 16, left: 12, right: 16, shift: -6 },
] as const;

const KNOB_HALF_HEIGHT = 2;

function Track({
  open,
  index,
  reducedMotion,
}: {
  open: boolean;
  index: number;
  reducedMotion: boolean;
}) {
  const { y, knob, left, right, shift } = TRACKS[index];
  const progress = useMotionValue(0);
  const leftD = useTransform(progress, (p) => `M${left + shift * p} ${y}H3`);
  const knobD = useTransform(
    progress,
    (p) => `M${knob + shift * p} ${y - KNOB_HALF_HEIGHT}v${KNOB_HALF_HEIGHT * 2}`
  );
  const rightD = useTransform(progress, (p) => `M21 ${y}H${right + shift * p}`);

  useEffect(() => {
    const target = open ? 1 : 0;

    if (reducedMotion) {
      progress.set(target);

      return;
    }
    const controls = animate(progress, target, {
      duration: KNOB_SLIDE_S,
      delay: index * KNOB_STAGGER_S,
      ease: KNOB_EASE,
    });

    return () => controls.stop();
  }, [open, index, progress, reducedMotion]);

  return (
    <>
      <motion.path d={leftD} />
      <motion.path d={knobD} />
      <motion.path d={rightD} />
    </>
  );
}

/** The composer options trigger's icon: its knobs slide when the settings panel opens. */
export function ComposerOptionsIcon({ open, size = 16 }: { open: boolean; size?: number }) {
  const reducedMotion = useReducedMotion() ?? false;

  return (
    <svg
      aria-hidden
      fill="none"
      height={size}
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      viewBox="0 0 24 24"
      width={size}
      xmlns="http://www.w3.org/2000/svg"
    >
      {TRACKS.map((_, index) => (
        <Track key={index} index={index} open={open} reducedMotion={reducedMotion} />
      ))}
    </svg>
  );
}
