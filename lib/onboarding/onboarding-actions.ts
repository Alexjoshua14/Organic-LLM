import {
  clearSessionHiddenTips,
  getOnboardingSnapshot,
  hideTipForSession,
  updateOnboardingState,
} from "./onboarding-store";
import {
  completeChecklistStep,
  dismissWelcome,
  markTipSeen,
  recordImplicitTipClose,
  recordTipShown,
  replayOnboarding,
  setChecklistHidden,
  setTipsEnabled,
  type ChecklistStepId,
  type OnboardingState,
  type TipOutcome,
} from "./onboarding-state";

/**
 * Side-effecting onboarding actions for components. Each is a no-op until an account is connected
 * (see `connectOnboardingStore`), so call sites never need to check auth first.
 */
export const onboardingActions = {
  tipSeen(id: string, version: number, outcome: TipOutcome, userId?: string) {
    return updateOnboardingState(
      (state) => markTipSeen(state, id, version, outcome, Date.now()),
      userId
    );
  },

  /** Hides the tip for this tab session; the second implicit close is permanent. */
  tipClosedImplicitly(id: string, version: number, userId = getOnboardingSnapshot().userId) {
    if (!userId || getOnboardingSnapshot().userId !== userId) return;
    hideTipForSession(id);
    void updateOnboardingState(
      (state) => recordImplicitTipClose(state, id, version, Date.now()),
      userId
    );
  },

  claimTip(userId: string, eligible: (state: OnboardingState, now: number) => boolean) {
    return updateOnboardingState((state) => {
      const now = Date.now();

      return eligible(state, now) ? recordTipShown(state, now) : state;
    }, userId);
  },

  setTipsEnabled(enabled: boolean, userId?: string) {
    return updateOnboardingState((state) => setTipsEnabled(state, enabled), userId);
  },

  dismissWelcome() {
    return updateOnboardingState((state) => dismissWelcome(state, Date.now()));
  },

  completeStep(step: ChecklistStepId, userId?: string | null) {
    return updateOnboardingState((state) => completeChecklistStep(state, step, Date.now()), userId);
  },

  setChecklistHidden(hidden: boolean) {
    return updateOnboardingState((state) => setChecklistHidden(state, hidden, Date.now()));
  },

  replay() {
    clearSessionHiddenTips();

    return updateOnboardingState((state) => replayOnboarding(state, Date.now()));
  },
};
