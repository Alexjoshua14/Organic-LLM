"use client";

import { useSyncExternalStore } from "react";

import {
  getFeatureTipInstances,
  getFeatureTipServerInstances,
  subscribeFeatureTips,
  type FeatureTipInstance,
} from "@/lib/onboarding/feature-tip-registry";
import { isApplePlatform } from "@/lib/onboarding/keyboard-shortcuts";
import {
  getOnboardingServerSnapshot,
  getOnboardingSnapshot,
  subscribeOnboarding,
  type OnboardingSnapshot,
} from "@/lib/onboarding/onboarding-store";

/** Onboarding state for the connected account; `status: "idle"` on the server and before auth. */
export function useOnboardingSnapshot(): OnboardingSnapshot {
  return useSyncExternalStore(
    subscribeOnboarding,
    getOnboardingSnapshot,
    getOnboardingServerSnapshot
  );
}

/** Mounted `<FeatureTip>` anchors. */
export function useFeatureTipInstances(): readonly FeatureTipInstance[] {
  return useSyncExternalStore(
    subscribeFeatureTips,
    getFeatureTipInstances,
    getFeatureTipServerInstances
  );
}

const noopSubscribe = () => () => {};

/**
 * Apple platform for shortcut labels. `false` on the server and during hydration, then the real
 * value, so server and client markup always match.
 */
export function useIsApplePlatform(): boolean {
  return useSyncExternalStore(
    noopSubscribe,
    () => isApplePlatform(typeof navigator === "undefined" ? undefined : navigator),
    () => false
  );
}
