import { z } from "zod";

/**
 * Onboarding state for one signed-in account on one device: which tips were seen, whether tips are
 * on, the welcome card, and checklist progress. Pure data + reducers; persistence lives in
 * `onboarding-store.ts`. Every reducer returns the same object when nothing changes, so the store
 * can skip writes and renders.
 */

export const ONBOARDING_STATE_VERSION = 1;

/** Accounts younger than this get the welcome card and automatic tips. */
export const ONBOARDING_ACCOUNT_WINDOW_DAYS = 30;

/** The second implicit close (click elsewhere, overlay opened…) makes a tip's dismissal permanent. */
export const IMPLICIT_CLOSES_BEFORE_PERMANENT = 2;

/** Tip display timestamps older than this are pruned (the rolling cap window). */
export const TIP_LOG_WINDOW_MS = 24 * 60 * 60 * 1000;

export const CHECKLIST_STEP_IDS = [
  "first-message",
  "try-arcadia",
  "rabbit-hole",
  "switch-ideas",
] as const;

export type ChecklistStepId = (typeof CHECKLIST_STEP_IDS)[number];

/**
 * How a tip ended:
 * - `dismissed`: Got it, Escape, or a second implicit close.
 * - `acted`: the person used the control the tip points at.
 * - `off`: shown, then tips were turned off from it.
 */
export type TipOutcome = "dismissed" | "acted" | "off";

const TipRecordSchema = z.object({
  version: z.number().int().nonnegative(),
  at: z.number(),
  outcome: z.enum(["dismissed", "acted", "off"]),
});

export const OnboardingStateSchema = z.object({
  v: z.literal(ONBOARDING_STATE_VERSION),
  tipsEnabled: z.boolean().default(true),
  welcomeDismissedAt: z.number().optional(),
  /** Set by Guide → Replay onboarding; bypasses the account-age window. */
  replayRequestedAt: z.number().optional(),
  migratedLegacy: z.boolean().default(false),
  tips: z.record(z.string(), TipRecordSchema).default({}),
  implicitCloses: z.record(z.string(), z.number().int().nonnegative()).default({}),
  /** When automatic tips were shown, for the cooldown and the rolling daily cap. */
  tipLog: z.array(z.number()).default([]),
  checklist: z
    .object({
      done: z.record(z.string(), z.number()).default({}),
      hiddenAt: z.number().optional(),
    })
    .default({ done: {} }),
});

export type OnboardingState = z.infer<typeof OnboardingStateSchema>;

export function createOnboardingState(): OnboardingState {
  return {
    v: ONBOARDING_STATE_VERSION,
    tipsEnabled: true,
    migratedLegacy: false,
    tips: {},
    implicitCloses: {},
    tipLog: [],
    checklist: { done: {} },
  };
}

/**
 * Parses stored JSON. Returns `null` for anything unreadable (bad JSON, wrong shape, unknown
 * version) so the caller can decide between a fresh state and showing nothing.
 */
export function parseOnboardingState(raw: string | null): OnboardingState | null {
  if (raw == null) return null;

  try {
    const result = OnboardingStateSchema.safeParse(JSON.parse(raw));

    return result.success ? result.data : null;
  } catch {
    return null;
  }
}

export function isTipSeen(state: OnboardingState, id: string, version: number): boolean {
  const record = state.tips[id];

  return record != null && record.version >= version;
}

export function markTipSeen(
  state: OnboardingState,
  id: string,
  version: number,
  outcome: TipOutcome,
  now: number
): OnboardingState {
  if (isTipSeen(state, id, version)) return state;

  return { ...state, tips: { ...state.tips, [id]: { version, at: now, outcome } } };
}

/**
 * Counts a close the person did not ask for. The caller hides the tip for the rest of the tab
 * session; the second such close makes it permanent.
 */
export function recordImplicitTipClose(
  state: OnboardingState,
  id: string,
  version: number,
  now: number
): OnboardingState {
  if (isTipSeen(state, id, version)) return state;

  const count = (state.implicitCloses[id] ?? 0) + 1;
  const next = { ...state, implicitCloses: { ...state.implicitCloses, [id]: count } };

  return count >= IMPLICIT_CLOSES_BEFORE_PERMANENT
    ? markTipSeen(next, id, version, "dismissed", now)
    : next;
}

export function pruneTipLog(log: readonly number[], now: number): number[] {
  return log.filter((at) => now - at < TIP_LOG_WINDOW_MS && at <= now);
}

export function recordTipShown(state: OnboardingState, now: number): OnboardingState {
  return { ...state, tipLog: [...pruneTipLog(state.tipLog, now), now] };
}

export function setTipsEnabled(state: OnboardingState, enabled: boolean): OnboardingState {
  return state.tipsEnabled === enabled ? state : { ...state, tipsEnabled: enabled };
}

export function dismissWelcome(state: OnboardingState, now: number): OnboardingState {
  return state.welcomeDismissedAt != null ? state : { ...state, welcomeDismissedAt: now };
}

export function completeChecklistStep(
  state: OnboardingState,
  step: ChecklistStepId,
  now: number
): OnboardingState {
  if (state.checklist.done[step] != null) return state;

  return {
    ...state,
    checklist: { ...state.checklist, done: { ...state.checklist.done, [step]: now } },
  };
}

export function setChecklistHidden(
  state: OnboardingState,
  hidden: boolean,
  now: number
): OnboardingState {
  if (hidden === (state.checklist.hiddenAt != null)) return state;

  return { ...state, checklist: { ...state.checklist, hiddenAt: hidden ? now : undefined } };
}

/**
 * Guide → Replay onboarding: every tip and the welcome card become new again, tips turn on, and
 * the account-age window is bypassed. Checklist progress is kept (it records real actions).
 */
export function replayOnboarding(state: OnboardingState, now: number): OnboardingState {
  return {
    ...state,
    welcomeDismissedAt: undefined,
    tipsEnabled: true,
    replayRequestedAt: now,
    tips: {},
    implicitCloses: {},
    tipLog: [],
    checklist: { ...state.checklist, hiddenAt: undefined },
  };
}

export type ChecklistProgress = { done: number; total: number; complete: boolean };

export function checklistProgress(state: OnboardingState): ChecklistProgress {
  const done = CHECKLIST_STEP_IDS.filter((id) => state.checklist.done[id] != null).length;

  return { done, total: CHECKLIST_STEP_IDS.length, complete: done === CHECKLIST_STEP_IDS.length };
}

/** True when automatic onboarding (welcome card, automatic tips) applies to this account. */
export function isAutoOnboardingEligible(
  state: OnboardingState,
  accountCreatedAt: Date | number | null | undefined,
  now: number
): boolean {
  if (state.replayRequestedAt != null) return true;
  if (accountCreatedAt == null) return false;

  const created =
    typeof accountCreatedAt === "number" ? accountCreatedAt : accountCreatedAt.getTime();

  if (!Number.isFinite(created)) return false;

  return now - created <= ONBOARDING_ACCOUNT_WINDOW_DAYS * 24 * 60 * 60 * 1000;
}

/** Legacy (pre-redesign) storage, read once per account namespace and never deleted here. */
export const LEGACY_TIP_DISMISS_KEY = "organic-llm-feature-hints-dismissed";
export const LEGACY_FIRST_SESSION_KEY = "organic-llm-first-session-checklist";

/**
 * Carries over what the old system can prove: dismissal versions for tips that still exist, and a
 * hidden first-steps checklist. Old checklist "completions" were link clicks, not actions, so they
 * are not carried over.
 */
export function migrateLegacyOnboarding(
  state: OnboardingState,
  legacy: { tipDismissals: string | null; firstSession: string | null },
  retainedTipIds: readonly string[],
  now: number
): OnboardingState {
  if (state.migratedLegacy) return state;

  let next: OnboardingState = { ...state, migratedLegacy: true };

  const dismissals = parseLegacyRecord(legacy.tipDismissals);

  for (const id of retainedTipIds) {
    const version = dismissals[id];

    if (typeof version === "number" && Number.isInteger(version) && version >= 0) {
      next = markTipSeen(next, id, version, "dismissed", now);
    }
  }

  const firstSession = parseLegacyRecord(legacy.firstSession);

  if (typeof firstSession.dismissedAt === "number") {
    next = setChecklistHidden(next, true, firstSession.dismissedAt);
  }

  return next;
}

function parseLegacyRecord(raw: string | null): Record<string, unknown> {
  if (!raw) return {};

  try {
    const parsed: unknown = JSON.parse(raw);

    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}
