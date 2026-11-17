"use client";

import type { ChatStatus } from "ai";

import { useEffect, useRef } from "react";
import {
  animate,
  motion,
  useMotionValue,
  useReducedMotion,
  useTransform,
  type AnimationPlaybackControls,
  type MotionValue,
} from "framer-motion";

/**
 * The send button's glyph, drawn as three strokes that morph between shapes.
 *
 * - `arrow`: the send arrow (a stem and two arms meeting at an apex).
 * - `working`: the arrow lifts a little, then its strokes bend into an open ring that spins.
 *   The left arm curves out counterclockwise and the right arm pulls clockwise along the rim.
 *   The stem does not swing outward: it slides up its own line, through the apex, and onto the
 *   rim, as if the ring were pulling it in. It ends as the long arc.
 * - `stop`: the ring closes into a rounded square. Shown while a send can be halted and the
 *   user hovers, focuses or presses the button.
 * - `error`: an X, faded in over the strokes.
 *
 * Every shape is the same three polylines of {@link POINTS} points, so any shape can morph into
 * any other by moving each point. The rotation is applied to the points, not to a group, which
 * keeps the whole thing one set of `d` strings.
 */
export type SubmitGlyphState = "arrow" | "working" | "stop" | "error";

/** Chat status and whether a click can stop it → the glyph's resting state. */
export function resolveSubmitGlyphState({
  status,
  canStop,
  stopRequested,
}: {
  status: ChatStatus | undefined;
  /** A click will call `stop`: false on Stage and in queue mode, which never stop. */
  canStop: boolean;
  /** Hover (mouse), keyboard focus or press (touch) is asking to halt the send. */
  stopRequested: boolean;
}): SubmitGlyphState {
  if (status === "error") return "error";
  if (status === "submitted" || status === "streaming") {
    return canStop && stopRequested ? "stop" : "working";
  }

  return "arrow";
}

/* ---- Timing ---------------------------------------------------------------------------- *
 * Each constant is a beat of the send gesture. They stay inside Material's ~200-400ms band for
 * each step, so no single step feels like waiting, and the whole arrow-to-ring takes ~0.44s.
 */
/** The arrow lifts before it bends, so the apex lands on the ring's top. */
const LIFT_S = 0.14;
/** Arrow strokes bending into the ring (and back). */
const MORPH_S = 0.4;
/** Ring closing into the square (and back). Shorter: it answers a hover. */
const SQUARE_S = 0.3;
/** Unwinding the spin to a whole turn so shapes line up before morphing back. */
const SETTLE_S = 0.25;
/**
 * One turn of the spinner: it eases through the turn, then holds briefly at the top before the
 * next, so the spin reads as a breath rather than a mechanical loop.
 */
const SPIN_TURN_S = 1;
const SPIN_PAUSE_S = 0.12;
/**
 * Material's standard curve: starts and ends gently, so a morph never snaps into motion or
 * stops dead.
 */
const EASE = [0.4, 0, 0.2, 1] as const;
/** Sine in-out for the spin: a soft speed-up and slow-down on each turn. */
const SPIN_EASE = [0.37, 0, 0.63, 1] as const;
/**
 * The morph starts this far into the lift (and the lift this far into the morph, going back),
 * so the two overlap instead of one stopping before the other starts.
 */
const OVERLAP = 0.5;

/* ---- Geometry -------------------------------------------------------------------------- */
/** Points per stroke; the same count in every shape is what makes them interpolable. */
const POINTS = 25;
const CENTER = 12;
const RING_RADIUS = 8;
/** Half the square's side, and the superellipse exponent that rounds its corners. */
const SQUARE_HALF = 6;
const SQUARE_EXPONENT = 5;
/** How far round the ring each stroke reaches (degrees clockwise from the top; negative is counterclockwise). */
const RIM = { stem: 210, right: 100, left: -60 } as const;
/** The arrow's apex and the lift that puts it on the ring's top. */
const ARROW_APEX_Y = 5;
const ARROW_LIFT = 1;
const ARROW_STEM_LENGTH = 14;
const ARROW_ARM = 7;

type Point = readonly [number, number];
type Stroke = "stem" | "right" | "left";

const STROKES: readonly Stroke[] = ["stem", "right", "left"];

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));
const lerp = (from: number, to: number, t: number) => from + (to - from) * t;

function arrowPoint(stroke: Stroke, s: number, lift: number): Point {
  const apexY = ARROW_APEX_Y - lift * ARROW_LIFT;

  if (stroke === "stem") return [CENTER, apexY + ARROW_STEM_LENGTH * s];
  const dx = stroke === "right" ? ARROW_ARM : -ARROW_ARM;

  return [CENTER + dx * s, apexY + ARROW_ARM * s];
}

/** Unit radius of a rounded square at an angle, so ring and square can share angles. */
function squareRadius(degrees: number): number {
  const radians = (degrees * Math.PI) / 180;
  const sin = Math.abs(Math.sin(radians));
  const cos = Math.abs(Math.cos(radians));

  return (
    1 /
    Math.pow(Math.pow(sin, SQUARE_EXPONENT) + Math.pow(cos, SQUARE_EXPONENT), 1 / SQUARE_EXPONENT)
  );
}

/** A point on the ring, or on its way to the square (`square` 0 = ring, 1 = square). */
function rimPoint(degrees: number, square: number): Point {
  const radians = (degrees * Math.PI) / 180;
  const radius = lerp(RING_RADIUS, SQUARE_HALF * squareRadius(degrees), square);

  return [CENTER + radius * Math.sin(radians), CENTER - radius * Math.cos(radians)];
}

/**
 * The stem rides a track: its own vertical line, then the rim clockwise from the apex. It
 * occupies a window of that track, `[tail, head]`, measured as length along it. The window
 * slides from the line (`[0, 14]`) onto the rim (`[14, 14 + arc]`), so the stem is pulled up
 * through the apex and fed onto the ring instead of sweeping out to it.
 */
function stemTrackPoint(distance: number, lift: number, square: number): Point {
  // The apex follows the rim's top as the ring becomes the square (6 at the square, 4 on the ring).
  const apexY = ARROW_APEX_Y - lift * ARROW_LIFT + (RING_RADIUS - SQUARE_HALF) * square;

  if (distance <= ARROW_STEM_LENGTH) return [CENTER, apexY + (ARROW_STEM_LENGTH - distance)];
  const degrees = ((distance - ARROW_STEM_LENGTH) / RING_RADIUS) * (180 / Math.PI);

  return rimPoint(degrees, square);
}

function stemPoint(index: number, morph: number, lift: number): Point {
  const s = index / (POINTS - 1);
  const toRing = clamp01(morph);
  const toSquare = clamp01(morph - 1);
  const arc = (lerp(RIM.stem, 360, toSquare) * Math.PI * RING_RADIUS) / 180;
  const tail = lerp(0, ARROW_STEM_LENGTH, toRing);
  const head = lerp(ARROW_STEM_LENGTH, ARROW_STEM_LENGTH + arc, toRing);

  // Index 0 is the head (the apex end of the arrow), the last index the tail.
  return stemTrackPoint(lerp(head, tail, s), lift, toSquare);
}

/**
 * Where a stroke's `index`th point sits for a morph position.
 *
 * - `morph` 0 is the arrow, 1 the ring and 2 the square; fractions blend neighbours.
 * - `lift` (0-1) raises the arrow before it bends.
 * - `spin` rotates the finished point about the glyph's centre, in degrees.
 */
export function submitGlyphPoint(
  stroke: Stroke,
  index: number,
  morph: number,
  lift: number,
  spin: number
): Point {
  let x: number;
  let y: number;

  if (stroke === "stem") {
    [x, y] = stemPoint(index, morph, lift);
  } else {
    const s = index / (POINTS - 1);
    const toRing = clamp01(morph);
    const rim = rimPoint(RIM[stroke] * s, clamp01(morph - 1));
    const arrow = arrowPoint(stroke, s, lift);

    x = lerp(arrow[0], rim[0], toRing);
    y = lerp(arrow[1], rim[1], toRing);
  }

  if (spin === 0) return [x, y];
  const radians = (spin * Math.PI) / 180;
  const dx = x - CENTER;
  const dy = y - CENTER;

  return [
    CENTER + dx * Math.cos(radians) - dy * Math.sin(radians),
    CENTER + dx * Math.sin(radians) + dy * Math.cos(radians),
  ];
}

const round = (value: number) => Math.round(value * 100) / 100;

/** The `d` attribute for one stroke. Round joins hide the polyline's corners. */
export function submitGlyphPath(stroke: Stroke, morph: number, lift: number, spin: number): string {
  let d = "";

  for (let index = 0; index < POINTS; index += 1) {
    const [x, y] = submitGlyphPoint(stroke, index, morph, lift, spin);

    d += `${index === 0 ? "M" : "L"}${round(x)} ${round(y)}`;
  }

  return d;
}

/** Where each state parks the motion values. */
const REST: Record<SubmitGlyphState, { morph: number; lift: number }> = {
  arrow: { morph: 0, lift: 0 },
  working: { morph: 1, lift: 1 },
  stop: { morph: 2, lift: 1 },
  error: { morph: 0, lift: 0 },
};

function GlyphStroke({
  stroke,
  morph,
  lift,
  spin,
  opacity,
}: {
  stroke: Stroke;
  morph: MotionValue<number>;
  lift: MotionValue<number>;
  spin: MotionValue<number>;
  opacity: MotionValue<number>;
}) {
  const d = useTransform([morph, lift, spin], ([m, l, s]: number[]) =>
    submitGlyphPath(stroke, m, l, s)
  );

  return <motion.path d={d} style={{ opacity }} />;
}

/**
 * The send button's icon. Decorative: the button carries the accessible name, so the SVG is
 * `aria-hidden`.
 */
export function SubmitGlyph({ state, size = 16 }: { state: SubmitGlyphState; size?: number }) {
  const reducedMotion = useReducedMotion() ?? false;
  const morph = useMotionValue(REST[state].morph);
  const lift = useMotionValue(REST[state].lift);
  const spin = useMotionValue(0);
  const errorMix = useMotionValue(state === "error" ? 1 : 0);
  const strokeOpacity = useTransform(errorMix, (mix) => 1 - mix);
  const spinRef = useRef<AnimationPlaybackControls | null>(null);

  useEffect(() => {
    let cancelled = false;
    const running: AnimationPlaybackControls[] = [];
    const play = (value: MotionValue<number>, to: number, duration: number, delay = 0) => {
      const controls = animate(value, to, { duration, delay, ease: EASE });

      running.push(controls);

      return controls;
    };
    const stopSpin = () => {
      spinRef.current?.stop();
      spinRef.current = null;
    };
    // The next whole turn, so the strokes line up with the unrotated shapes when it lands.
    const settleSpin = async (duration: number) => {
      stopSpin();
      const target = Math.ceil((spin.get() - 1e-6) / 360) * 360;

      if (target - spin.get() > 0.5) await play(spin, target, duration);
      if (!cancelled) spin.set(0);
    };

    const run = async () => {
      const rest = REST[state];

      if (state === "error") {
        stopSpin();
        await play(errorMix, 1, MORPH_S / 2);

        return;
      }
      if (errorMix.get() > 0) play(errorMix, 0, MORPH_S / 2);

      if (reducedMotion) {
        // Shapes settle without travelling; work shows as a still ring.
        stopSpin();
        morph.set(rest.morph);
        lift.set(rest.lift);
        spin.set(0);

        return;
      }

      if (state === "working") {
        const lifting = lift.get() < 1;

        await Promise.all([
          lifting ? play(lift, 1, LIFT_S) : null,
          Math.abs(morph.get() - 1) > 0.001
            ? play(morph, 1, morph.get() > 1 ? SQUARE_S : MORPH_S, lifting ? LIFT_S * OVERLAP : 0)
            : null,
          settleSpin(SETTLE_S),
        ]);
        if (cancelled || spinRef.current) return;
        const from = spin.get();

        const total = SPIN_TURN_S + SPIN_PAUSE_S;

        // Ease through the turn, then hold; the loop restarts at the same angle (mod 360).
        spinRef.current = animate(spin, [from, from + 360, from + 360], {
          duration: total,
          times: [0, SPIN_TURN_S / total, 1],
          ease: [SPIN_EASE, "linear"],
          repeat: Infinity,
        });
      } else if (state === "stop") {
        if (lift.get() < 1) lift.set(1);
        await Promise.all([play(morph, 2, SQUARE_S), settleSpin(SETTLE_S)]);
      } else {
        await Promise.all([
          play(morph, 0, MORPH_S),
          play(lift, 0, LIFT_S, MORPH_S * OVERLAP),
          settleSpin(SETTLE_S),
        ]);
      }
    };

    void run();

    return () => {
      cancelled = true;
      for (const controls of running) controls.stop();
    };
  }, [state, reducedMotion, morph, lift, spin, errorMix]);

  // The spinner outlives a single effect run; stop it only when the glyph unmounts.
  useEffect(() => () => spinRef.current?.stop(), []);

  return (
    <svg
      aria-hidden
      data-glyph-state={state}
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
      {STROKES.map((stroke) => (
        <GlyphStroke
          key={stroke}
          lift={lift}
          morph={morph}
          opacity={strokeOpacity}
          spin={spin}
          stroke={stroke}
        />
      ))}
      <motion.path d="M6 6l12 12M18 6 6 18" style={{ opacity: errorMix }} />
    </svg>
  );
}
