"use client";

import { createContext, useContext } from "react";

export type GuideTab = "start" | "shortcuts" | "tips";

export type OnboardingContextValue = {
  /** Signed in and the account is new enough for the welcome card and automatic tips. */
  autoEligible: boolean;
  signedIn: boolean;
  guideOpen: boolean;
  guideTab: GuideTab;
  openGuide: (tab?: GuideTab) => void;
  setGuideOpen: (open: boolean) => void;
  setGuideTab: (tab: GuideTab) => void;
};

const noop = () => {};

const FALLBACK: OnboardingContextValue = {
  autoEligible: false,
  signedIn: false,
  guideOpen: false,
  guideTab: "start",
  openGuide: noop,
  setGuideOpen: noop,
  setGuideTab: noop,
};

export const OnboardingContext = createContext<OnboardingContextValue>(FALLBACK);

/** Guide controls and onboarding eligibility. Outside `OnboardingHost` it is inert. */
export function useOnboarding(): OnboardingContextValue {
  return useContext(OnboardingContext);
}
