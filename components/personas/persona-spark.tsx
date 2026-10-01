"use client";

import { useId, type CSSProperties } from "react";

import { SPARK_TIMING_VARS } from "./persona-spark-timing";

import { cn } from "@/lib/utils";

import "./persona-spark.css";

/**
 * The Artist assistant's visual: Spark's glass from Stratum (lessons branch,
 * `components/lessons/spark-mark.tsx`). A glowing orb seen through a panel of fluted glass with
 * a little film grain; each flute shows the orb through its own lens (a squeezed viewBox) and
 * shifts it by its own phase of one shared clock (`--persona-spark-t`), so light ripples across
 * the glass. Colours come from `currentColor`. CSS only — nothing here pulls in Motion.
 *
 * Ported as-is for the icon; the emblem is a finer cut of the same glass for large sizes, where
 * the icon's six flutes and grain would read coarse. Persona states layer on top of the clock
 * and never touch it, so every mark still steps in sync.
 */

/** One loop of the clock in seconds. Keep in sync with `.persona-spark-mark` in the stylesheet. */
const PERIOD_S = 11;
/** 12 steps a second reads as smooth at icon sizes and costs a fraction of 60. */
const DEFAULT_FPS = 12;
/** How much wider a slice of the orb each flute squeezes into itself. */
const LENS = 2;
/** At and above this size the emblem cut replaces the icon. */
const EMBLEM_MIN_PX = 64;

const GLOW_STOPS = [0, 0.22, 0.5, 0.8, 1];
/** Groove line, shadowed left side, light gathering toward the right edge. */
const ROD_STOPS = [0, 0.06, 0.06, 0.5, 0.9, 1];

/** Uneven on purpose, so the ripple doesn't read as a conveyor. */
const phaseOf = (index: number) => Math.round(index * 77 + 31 * Math.sin(index * 2.3) + 360) % 360;

type Glass = {
  width: number;
  height: number;
  flute: number;
  /** Orb centre and radii. */
  orb: [number, number, number, number];
  /** Grain frequency in viewBox units; smaller is coarser. */
  grain: number;
  radius: number;
};

const ICON: Glass = {
  width: 24,
  height: 24,
  flute: 4,
  orb: [13, 13, 13, 13],
  grain: 1.4,
  radius: 4,
};
/** Same proportions, twice the resolution: eight flutes and grain that stays fine when large. */
const EMBLEM: Glass = {
  width: 48,
  height: 48,
  flute: 6,
  orb: [26, 26, 26, 26],
  grain: 1.1,
  radius: 8,
};

/** Where the shared clock starts: the first mark's own start, so a running mark never jumps. */
let clockOrigin: CSSNumberish | null = null;

/**
 * Puts a Spark animation on the shared clock: its phase follows wall time from one origin, so a
 * mark that mounts late, or restarts after `display: none`, joins mid-cycle in step with the
 * rest. Skipped frames are not queued. Nothing here runs per frame.
 */
export function joinSparkClock(animation: Animation) {
  if ((animation as CSSAnimation).animationName !== "persona-spark-drift") return;
  clockOrigin ??= animation.startTime ?? document.timeline.currentTime;
  if (clockOrigin !== null) animation.startTime = clockOrigin;
}

// Runs as the mark commits, before its first paint.
const syncClock = (svg: SVGSVGElement | null) => svg?.getAnimations?.().forEach(joinSparkClock);

// A mark that comes back from `display: none` restarts its animation without remounting; that
// restart rejoins on its next frame. One listener for the whole app.
if (typeof document !== "undefined") {
  document.addEventListener("animationstart", (event) => {
    if (event.animationName === "persona-spark-drift") {
      (event.target as Element).getAnimations?.().forEach(joinSparkClock);
    }
  });
}

function Glass({
  glass,
  className,
  fps = DEFAULT_FPS,
}: {
  glass: Glass;
  className: string;
  fps?: number;
}) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const id = (name: string) => `${uid}-${name}`;
  const ref = (name: string) => `url(#${id(name)})`;
  const { width, height, flute, orb, radius } = glass;
  const count = Math.ceil(width / flute);
  const size = width / count;
  const flutes = Array.from({ length: count }, (_, index) => index * size);

  return (
    <svg
      ref={syncClock}
      aria-hidden="true"
      className={className}
      height={height}
      preserveAspectRatio="xMidYMid slice"
      style={{ "--persona-spark-steps": Math.round(fps * PERIOD_S) } as CSSProperties}
      viewBox={`0 0 ${width} ${height}`}
      width={width}
    >
      <defs>
        <radialGradient className="persona-spark-glow" fx="0.55" fy="0.6" id={id("glow")}>
          {GLOW_STOPS.map((offset) => (
            <stop key={offset} offset={offset} />
          ))}
        </radialGradient>
        <linearGradient className="persona-spark-rod" id={id("rod")}>
          {ROD_STOPS.map((offset, index) => (
            <stop key={index} offset={offset} />
          ))}
        </linearGradient>
        <radialGradient className="persona-spark-vignette" id={id("vignette")}>
          <stop offset="0.6" />
          <stop offset="1" />
        </radialGradient>
        <filter id={id("grain")}>
          <feTurbulence baseFrequency={glass.grain} type="fractalNoise" />
          <feColorMatrix values="1 0 0 0 0 1 0 0 0 0 1 0 0 0 0 0 0 0 0 1" />
        </filter>
        <clipPath id={id("tile")}>
          <rect height={height} rx={radius} width={width} />
        </clipPath>
        <ellipse
          cx={orb[0]}
          cy={orb[1]}
          fill={ref("glow")}
          id={id("orb")}
          rx={orb[2]}
          ry={orb[3]}
        />
      </defs>
      <g clipPath={ref("tile")}>
        <rect className="persona-spark-panel" height={height} width={width} />
        <g className="persona-spark-light">
          {flutes.map((x, index) => (
            <svg
              key={index}
              height={height}
              preserveAspectRatio="none"
              viewBox={`${x + (size * (1 - LENS)) / 2} 0 ${size * LENS} ${height}`}
              width={size}
              x={x}
            >
              <use
                className="persona-spark-orb"
                href={`#${id("orb")}`}
                style={{ "--phase": `${phaseOf(index)}deg` } as CSSProperties}
              />
            </svg>
          ))}
        </g>
        {flutes.map((x, index) => (
          <rect key={index} fill={ref("rod")} height={height} width={size} x={x} />
        ))}
        <rect fill={ref("vignette")} height={height} width={width} />
        <rect className="persona-spark-grain" filter={ref("grain")} height={height} width={width} />
      </g>
      <rect
        className="persona-spark-rim"
        height={height - 0.5}
        rx={radius && radius - 0.25}
        width={width - 0.5}
        x="0.25"
        y="0.25"
      />
    </svg>
  );
}

/** What the persona is doing; drives light, breath and the heard pulse. */
export type PersonaSparkState = "inactive" | "idle" | "listening" | "deciding" | "speaking";

export function PersonaSpark({
  size = 24,
  state = "idle",
  pulseKey,
  className,
  fps,
}: {
  size?: number;
  state?: PersonaSparkState;
  /** Change it to replay the heard pulse (e.g. a receipt timestamp); omit for no pulse. */
  pulseKey?: number | string | null;
  className?: string;
  fps?: number;
}) {
  const emblem = size >= EMBLEM_MIN_PX;

  return (
    <span
      aria-hidden="true"
      className={cn(
        "persona-spark relative inline-flex shrink-0",
        state === "inactive" ? "text-muted-foreground" : "text-teal-600 dark:text-teal-300",
        className
      )}
      data-state={state}
      style={{ width: size, height: size, ...SPARK_TIMING_VARS } as CSSProperties}
    >
      <Glass
        className="persona-spark-mark size-full"
        fps={fps ?? (size >= 160 ? 30 : size >= EMBLEM_MIN_PX ? 24 : undefined)}
        glass={emblem ? EMBLEM : ICON}
      />
      {pulseKey != null && state !== "inactive" ? (
        <span
          key={pulseKey}
          className="persona-spark-pulse"
          style={{ borderRadius: emblem ? "16%" : "17%" }}
        />
      ) : null}
    </span>
  );
}
