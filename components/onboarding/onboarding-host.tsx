"use client";

import { FeatureHintLayer } from "./feature-hint-layer";
import { FirstSessionSheet } from "./first-session-sheet";

import { FeatureHintRegistryProvider } from "@/lib/onboarding/feature-hint-context";

/**
 * Global onboarding overlays — mounted once; hints register anchors in place without
 * shifting layout.
 */
export function OnboardingHost({ children }: { children: React.ReactNode }) {
  return (
    <FeatureHintRegistryProvider>
      {children}
      <FeatureHintLayer />
      <FirstSessionSheet />
    </FeatureHintRegistryProvider>
  );
}
