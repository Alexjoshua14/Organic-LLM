import type { LiveVoicePhase } from "@/hooks/use-realtime-voice";
import type { SpeakBudgetSnapshot } from "@/lib/speak/types";

/**
 * Pure derivations for the Speak stage. The page renders these; it does not decide them.
 * Kept free of React so every state the stage can show is unit-testable without a mic, a
 * peer connection, or a paid Realtime session.
 */

export type SpeakStageConnection = {
  connected: boolean;
  connecting: boolean;
  paused: boolean;
  error: string | null;
  phase: LiveVoicePhase;
  muted: boolean;
};

export type SpeakStageStatusKind =
  | "ready"
  | "connecting"
  | "listening"
  | "thinking"
  | "speaking"
  | "muted"
  | "paused"
  | "error";

export type SpeakStageStatus = {
  kind: SpeakStageStatusKind;
  /** One or two words, large under the orb. */
  label: string;
  /** One sentence of guidance under the label. */
  detail: string;
  /** Whether the call is live and audio is flowing. Drives the status dot. */
  live: boolean;
};

/**
 * What the stage says right now. Errors win over every other state so a failed connect never
 * reads as "Ready". Muted wins over phase because the user needs to know they are not heard.
 */
export function deriveSpeakStageStatus(state: SpeakStageConnection): SpeakStageStatus {
  if (state.error && !state.connected) {
    return {
      kind: "error",
      label: "Couldn't connect",
      detail: state.error,
      live: false,
    };
  }

  if (state.connecting) {
    return {
      kind: "connecting",
      label: "Connecting",
      detail: "Opening a secure voice line…",
      live: false,
    };
  }

  if (state.connected) {
    if (state.muted) {
      return {
        kind: "muted",
        label: "Muted",
        detail: "Organic can't hear you. A long quiet stretch still pauses the call.",
        live: true,
      };
    }

    switch (state.phase) {
      case "speaking":
        return {
          kind: "speaking",
          label: "Speaking",
          detail: "Just start talking to interrupt.",
          live: true,
        };
      case "thinking":
        return {
          kind: "thinking",
          label: "Thinking",
          detail: "Working on a reply.",
          live: true,
        };
      default:
        return {
          kind: "listening",
          label: "Listening",
          detail: "Speak naturally. Pause when you're done.",
          live: true,
        };
    }
  }

  if (state.paused) {
    return {
      kind: "paused",
      label: "Paused",
      detail: "Paused after a quiet stretch so silence isn't billed. Resume where you left off.",
      live: false,
    };
  }

  return {
    kind: "ready",
    label: "Ready when you are",
    detail: "Start a call and talk. Your last Speak conversation picks up where it ended.",
    live: false,
  };
}

export type SpeakPrimaryAction = "start" | "resume" | "end" | "connecting";

export function speakPrimaryAction(
  state: Pick<SpeakStageConnection, "connected" | "connecting" | "paused">
): SpeakPrimaryAction {
  if (state.connecting) return "connecting";
  if (state.connected) return "end";
  if (state.paused) return "resume";

  return "start";
}

export const SPEAK_PRIMARY_ACTION_LABEL: Record<SpeakPrimaryAction, string> = {
  start: "Start voice call",
  resume: "Resume voice call",
  end: "End voice call",
  connecting: "Connecting voice call",
};

/** Minutes left today at or below which the meter warns. */
export const SPEAK_BUDGET_WARN_MINUTES = 5;
/** Share of the monthly voice spend cap at or above which the meter warns. */
export const SPEAK_BUDGET_WARN_COST_RATIO = 0.8;

export type SpeakBudgetMeter = {
  /** 0–1 share of today's minutes still available. */
  minutesFraction: number;
  minutesRemaining: number;
  minutesCap: number;
  costRemainingUsd: number;
  level: "ok" | "warn" | "exhausted";
  /** Short, glanceable. */
  label: string;
  /** Full sentence for the tooltip and screen readers. */
  description: string;
};

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;

  return Math.min(1, Math.max(0, value));
}

export function speakBudgetMeter(budget: SpeakBudgetSnapshot | null): SpeakBudgetMeter | null {
  if (!budget) return null;

  const minutesCap = Math.max(0, budget.dailyMinutesCap);
  const minutesRemaining = Math.max(0, Math.floor(budget.dailyMinutesRemaining));
  const minutesFraction = minutesCap > 0 ? clamp01(minutesRemaining / minutesCap) : 0;
  const costRemainingUsd = Math.max(0, budget.monthlyCostRemainingUsd);
  const costRatio =
    budget.monthlyCostCapUsd > 0 ? budget.monthlyCostUsedUsd / budget.monthlyCostCapUsd : 0;

  const exhausted =
    minutesRemaining <= 0 || (budget.monthlyCostCapUsd > 0 && costRemainingUsd <= 0);
  const warn =
    minutesRemaining <= SPEAK_BUDGET_WARN_MINUTES || costRatio >= SPEAK_BUDGET_WARN_COST_RATIO;

  const level = exhausted ? "exhausted" : warn ? "warn" : "ok";
  const label = exhausted ? "No voice time left" : `${minutesRemaining}m left today`;

  return {
    minutesFraction,
    minutesRemaining,
    minutesCap,
    costRemainingUsd,
    level,
    label,
    description:
      `${minutesRemaining} of ${minutesCap} voice minutes left today, ` +
      `$${costRemainingUsd.toFixed(2)} of voice spend left this month, ` +
      `up to ${budget.sessionMaxMinutes} minutes per call.`,
  };
}

export type SpeakShortcut = "primary" | "toggle-mute" | "toggle-transcript";

export type SpeakShortcutEvent = {
  key: string;
  metaKey?: boolean;
  ctrlKey?: boolean;
  altKey?: boolean;
  repeat?: boolean;
  /** The focused element's tag name, upper-case as the DOM reports it. */
  targetTag?: string | null;
  targetEditable?: boolean;
  /** Focus is on an interactive control that already owns Space and Enter. */
  targetInteractive?: boolean;
};

const TYPING_TAGS = new Set(["INPUT", "TEXTAREA", "SELECT"]);

/**
 * Keyboard map for the stage. Never ends a call: a stray key must not hang up on someone,
 * so ending is the button only.
 *
 * - Space: start or resume when idle; mute or unmute while live.
 * - M: mute or unmute while live.
 * - T: show or hide the transcript.
 */
export function speakShortcutFor(
  event: SpeakShortcutEvent,
  state: Pick<SpeakStageConnection, "connected" | "connecting">
): SpeakShortcut | null {
  if (event.metaKey || event.ctrlKey || event.altKey || event.repeat) return null;
  if (event.targetEditable) return null;
  if (event.targetTag && TYPING_TAGS.has(event.targetTag)) return null;

  const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;

  if (key === " " || key === "Spacebar") {
    // A focused button already activates on Space; handling it here would double-fire.
    if (event.targetInteractive) return null;
    if (state.connecting) return null;

    return state.connected ? "toggle-mute" : "primary";
  }

  if (key === "m") return state.connected ? "toggle-mute" : null;
  if (key === "t") return "toggle-transcript";

  return null;
}
