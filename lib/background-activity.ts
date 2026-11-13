import { z } from "zod";

/**
 * Background activity: how often in-view probes (e.g. the Arcadia subagent Jev heartbeat) run,
 * chosen by the user under Settings → AI. Every mode pauses probes for hidden tabs or locked
 * screens and on low power; every mode but Realtime also pauses for idle clients.
 */
export const BACKGROUND_ACTIVITY_MODES = [
  "default",
  "performance",
  "realtime",
  "saver",
  "daily",
] as const;

export const BackgroundActivityModeSchema = z.enum(BACKGROUND_ACTIVITY_MODES);

export type BackgroundActivityMode = z.infer<typeof BackgroundActivityModeSchema>;

export const DEFAULT_BACKGROUND_ACTIVITY_MODE: BackgroundActivityMode = "default";

/**
 * Probe cadence per mode.
 * - Realtime 10s: for live multi-agent runs. A Jev check is about 2.5k input tokens at $0.04/M
 *   (~$0.0001), so even a board that changes every tick costs under $0.90 a day; an unchanged
 *   board never reaches Jev and costs only database reads. The orchestrator turn a notable change
 *   triggers is the real cost, and the automatic-continuation caps bound that.
 * - Performance 30s: subagent results surface about as fast as the board's own poll.
 * - Default 60s: the owner's suggested once-a-minute heartbeat.
 * - Cost / battery saver 5m: a few Jev calls an hour at most; results still arrive in-session.
 * - Daily 24h: one catch-up per day, the first time the thread is in view.
 * Only a changed subagent board reaches Jev, so these are ceilings on spend, not a fixed cost.
 */
export const BACKGROUND_ACTIVITY_INTERVAL_MS: Readonly<Record<BackgroundActivityMode, number>> = {
  realtime: 10_000,
  performance: 30_000,
  default: 60_000,
  saver: 5 * 60_000,
  daily: 24 * 60 * 60_000,
};

/** No pointer, key, wheel, or touch input for this long and the client counts as idle. */
export const BACKGROUND_ACTIVITY_IDLE_AFTER_MS = 5 * 60_000;

/**
 * How often the client re-checks whether a probe is due. Local only — no network. Must stay well
 * under the fastest cadence (Realtime, 10s) or it, not the mode, sets the real rate.
 */
export const BACKGROUND_ACTIVITY_CHECK_MS = 2_500;

/** Battery at or below this, and not charging, counts as low power. */
export const BACKGROUND_ACTIVITY_LOW_BATTERY_LEVEL = 0.2;

export const BACKGROUND_ACTIVITY_OPTIONS: ReadonlyArray<{
  value: BackgroundActivityMode;
  label: string;
  description: string;
}> = [
  {
    value: "default",
    label: "Default",
    description: "Checks on background agents about once a minute.",
  },
  {
    value: "performance",
    label: "Performance",
    description: "Checks on background agents every 30 seconds.",
  },
  {
    value: "realtime",
    label: "Realtime",
    description:
      "Every 10 seconds, and keeps going while you step away. For live multi-agent runs.",
  },
  {
    value: "saver",
    label: "Cost / battery saver",
    description: "Every 5 minutes. Fewer model calls and less battery.",
  },
  {
    value: "daily",
    label: "Daily",
    description: "One catch-up a day, the first time you open the thread.",
  },
];

export type ProbeEnvironment = {
  /** Tab hidden, window minimised, or screen locked. */
  hidden: boolean;
  idleForMs: number;
  lowPower: boolean;
};

export type ProbePauseReason = "hidden" | "idle" | "low-power";

export function resolveProbePause(
  mode: BackgroundActivityMode,
  env: ProbeEnvironment
): ProbePauseReason | null {
  if (env.hidden) return "hidden";
  // Realtime keeps a multi-agent run alive while the user watches without touching input.
  if (mode !== "realtime" && env.idleForMs >= BACKGROUND_ACTIVITY_IDLE_AFTER_MS) return "idle";
  if (env.lowPower) return "low-power";

  return null;
}

export function isProbeDue(args: {
  mode: BackgroundActivityMode;
  lastProbeAt: number | null;
  now: number;
}): boolean {
  if (args.lastProbeAt === null) return true;

  return args.now - args.lastProbeAt >= BACKGROUND_ACTIVITY_INTERVAL_MS[args.mode];
}

/** Battery API reading (Chromium only) plus the Save-Data hint. Safari Low Power Mode is invisible. */
export function isLowPower(args: {
  battery?: { charging: boolean; level: number } | null;
  saveData?: boolean;
}): boolean {
  if (args.saveData) return true;
  if (!args.battery) return false;

  return !args.battery.charging && args.battery.level <= BACKGROUND_ACTIVITY_LOW_BATTERY_LEVEL;
}
