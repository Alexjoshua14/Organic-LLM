/**
 * Arcadia weave-in / weave-out policy for Realtime Speak.
 *
 * Timing constants live next to the effect (design backbone). Pure helpers stay
 * unit-testable without WebRTC.
 */

import type { PlanBudgetSnapshot } from "@/lib/plans/plan-tags";

/**
 * Mutual silence before an Arcadia weave session hangs up.
 * Approved band: 20–30s — long enough to pause mid-thought, short enough to stop billing.
 */
export const SPEAK_WEAVE_IDLE_HANGUP_MS = 25_000;

/** Poll interval for the idle hangup timer (not the hangup threshold). */
export const SPEAK_WEAVE_IDLE_POLL_MS = 1_000;

/**
 * Verified weekly plan gate — same as multi-mode queue.
 * Exhausted or unreadable budgets refuse weave-in and Speak-to mint.
 */
export function canStartRealtimeGivenPlanBudget(budget: PlanBudgetSnapshot): boolean {
  return budget.canDispatch === true;
}

/**
 * Weave sessions must not push screen ambient or continuous context dumps.
 * Progress stays on silent `/progress`; milestones only when already live.
 */
export function shouldSuppressAmbientDuringWeave(weaveMode: boolean): boolean {
  return weaveMode === true;
}

/**
 * Milestones never auto-open a Realtime session — only announce on an existing call.
 */
export function shouldAutoOpenRealtimeForMilestone(): boolean {
  return false;
}

export function canAnnounceMilestone(sessionLive: boolean): boolean {
  return sessionLive === true;
}

/**
 * True when neither side has spoken for {@link SPEAK_WEAVE_IDLE_HANGUP_MS}.
 * While either is speaking, activity is considered fresh.
 */
export function shouldIdleHangup(args: {
  weaveMode: boolean;
  connected: boolean;
  userSpeaking: boolean;
  assistantSpeaking: boolean;
  lastActivityAt: number;
  now: number;
  timeoutMs?: number;
}): boolean {
  if (!args.weaveMode || !args.connected) return false;
  if (args.userSpeaking || args.assistantSpeaking) return false;

  const timeout = args.timeoutMs ?? SPEAK_WEAVE_IDLE_HANGUP_MS;

  return args.now - args.lastActivityAt >= timeout;
}

/** Starting weave-in or Speak-to always ends any live session first (single session / user). */
export function shouldEndPreviousSessionBeforeWeaveIn(): boolean {
  return true;
}
