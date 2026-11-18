"use client";

import { useAuth, useUser } from "@clerk/nextjs";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";

import { FeatureTipLayer } from "./feature-tip-layer";
import {
  OnboardingContext,
  type GuideTab,
  type OnboardingContextValue,
} from "./onboarding-context";
import { OnboardingGuide } from "./onboarding-guide";

import { useOnboardingSnapshot } from "@/hooks/use-onboarding";
import { connectOnboardingStore } from "@/lib/onboarding/onboarding-store";
import { isAutoOnboardingEligible } from "@/lib/onboarding/onboarding-state";

/**
 * Mounted once in the session shell. Connects onboarding state to the signed-in account, owns the
 * Guide's open state, and renders the Guide and the feature-tip layer. Adds no layout.
 */
export function OnboardingHost({ children }: { children: ReactNode }) {
  const { isLoaded, isSignedIn, userId } = useAuth();
  const { user } = useUser();
  const onboarding = useOnboardingSnapshot();
  const [guideOpen, setGuideOpen] = useState(false);
  const [guideTab, setGuideTab] = useState<GuideTab>("start");
  // Read once per mount: the 30-day window does not need to tick while the app is open.
  const [now] = useState(() => Date.now());

  const connectedUser = isLoaded && isSignedIn ? (userId ?? null) : null;

  useEffect(() => connectOnboardingStore(connectedUser), [connectedUser]);

  const accountCreatedAt = user?.createdAt ?? null;
  const autoEligible =
    onboarding.status === "ready" &&
    isAutoOnboardingEligible(onboarding.state, accountCreatedAt, now);

  const openGuide = useCallback((tab: GuideTab = "start") => {
    setGuideTab(tab);
    setGuideOpen(true);
  }, []);

  const value = useMemo<OnboardingContextValue>(
    () => ({
      autoEligible,
      signedIn: connectedUser != null,
      guideOpen,
      guideTab,
      openGuide,
      setGuideOpen,
      setGuideTab,
    }),
    [autoEligible, connectedUser, guideOpen, guideTab, openGuide]
  );

  return (
    <OnboardingContext.Provider value={value}>
      {children}
      <OnboardingGuide />
      {connectedUser ? <FeatureTipLayer /> : null}
    </OnboardingContext.Provider>
  );
}
