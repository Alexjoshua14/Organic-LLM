import {
  clearSessionHiddenTips,
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
  type TipOutcome,
} from "./onboarding-state";

/**
 * Side-effecting onboarding actions for components. Each is a no-op until an account is connected
 * (see `connectOnboardingStore`), so call sites never need to check auth first.
 */
export const onboardingActions = {
  tipSeen(id: string, version: number, outcome: TipOutcome) {
    updateOnboardingState((state) => markTipSeen(state, id, version, outcome, Date.now()));
  },

  /** Hides the tip for this tab session; the second implicit close is permanent. */
  tipClosedImplicitly(id: string, version: number) {
    hideTipForSession(id);
    updateOnboardingState((state) => recordImplicitTipClose(state, id, version, Date.now()));
  },

  tipShown() {
    updateOnboardingState((state) => recordTipShown(state, Date.now()));
  },

  setTipsEnabled(enabled: boolean) {
    updateOnboardingState((state) => setTipsEnabled(state, enabled));
  },

  dismissWelcome() {
    updateOnboardingState((state) => dismissWelcome(state, Date.now()));
  },

  completeStep(step: ChecklistStepId) {
    updateOnboardingState((state) => completeChecklistStep(state, step, Date.now()));
  },

  setChecklistHidden(hidden: boolean) {
    updateOnboardingState((state) => setChecklistHidden(state, hidden, Date.now()));
  },

  replay() {
    clearSessionHiddenTips();
    updateOnboardingState((state) => replayOnboarding(state, Date.now()));
  },
};
