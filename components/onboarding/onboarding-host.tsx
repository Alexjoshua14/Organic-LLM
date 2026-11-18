"use client";

import { useAuth, useUser } from "@clerk/nextjs";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

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
  const welcomeShownFor = useRef<string | null>(null);
  const [guideOpen, setGuideOpen] = useState(false);
  const [guideTab, setGuideTab] = useState<GuideTab>("start");
  // Read once per mount: the 30-day window does not need to tick while the app is open.
  const [now] = useState(() => Date.now());

  const connectedUser = isLoaded && isSignedIn ? (userId ?? null) : null;

  useEffect(() => connectOnboardingStore(connectedUser), [connectedUser]);

  const accountCreatedAt = user?.createdAt ?? null;
  const autoEligible =
    connectedUser != null &&
    onboarding.userId === connectedUser &&
    user?.id === connectedUser &&
    onboarding.status === "ready" &&
    isAutoOnboardingEligible(onboarding.state, accountCreatedAt, now);

  const openGuide = useCallback((tab: GuideTab = "start") => {
    setGuideTab(tab);
    setGuideOpen(true);
  }, []);

  const markWelcomeShown = useCallback(() => {
    welcomeShownFor.current = connectedUser;
  }, [connectedUser]);

  const consumeWelcomeVisit = useCallback(() => {
    if (!connectedUser || welcomeShownFor.current !== connectedUser) return false;
    welcomeShownFor.current = null;

    return true;
  }, [connectedUser]);

  const value = useMemo<OnboardingContextValue>(
    () => ({
      autoEligible,
      signedIn: connectedUser != null,
      markWelcomeShown,
      guideOpen,
      guideTab,
      openGuide,
      setGuideOpen,
      setGuideTab,
    }),
    [autoEligible, connectedUser, guideOpen, guideTab, markWelcomeShown, openGuide]
  );

  return (
    <OnboardingContext.Provider value={value}>
      {children}
      <OnboardingGuide />
      {connectedUser && onboarding.userId === connectedUser ? (
        <FeatureTipLayer key={connectedUser} consumeWelcomeVisit={consumeWelcomeVisit} />
      ) : null}
    </OnboardingContext.Provider>
  );
}
