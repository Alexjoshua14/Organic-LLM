"use client";

import { useSyncExternalStore } from "react";

import {
  isExplicitFeatureGuideRequested,
  subscribeExplicitFeatureGuideRequest,
} from "@/lib/onboarding/feature-hint-explicit-request";
import {
  getFeatureHintSessionState,
  getSessionDismissedFeatureHintIds,
  getSessionDismissedFeatureHintVersion,
  subscribeFeatureHintSession,
} from "@/lib/onboarding/feature-hint-session";

export function useFeatureHintSession(pathname: string) {
  return useSyncExternalStore(
    subscribeFeatureHintSession,
    () => getFeatureHintSessionState(pathname),
    () => getFeatureHintSessionState(pathname)
  );
}

export function useExplicitFeatureGuideRequested() {
  return useSyncExternalStore(
    subscribeExplicitFeatureGuideRequest,
    () => isExplicitFeatureGuideRequested(),
    () => false
  );
}

export function useSessionDismissedFeatureHintIds() {
  const version = useSyncExternalStore(
    subscribeFeatureHintSession,
    () => getSessionDismissedFeatureHintVersion(),
    () => 0
  );

  // Version bumps when the underlying set mutates.
  void version;

  return getSessionDismissedFeatureHintIds();
}
