"use client";

import { Sparkles, X } from "lucide-react";
import { useContext, useSyncExternalStore } from "react";

import { useOnboarding } from "./onboarding-context";

import { glass } from "@/components/design-system/primitives";
import { Button } from "@/components/third-party/ui/button";
import { VoiceSessionContext } from "@/components/voice/voice-session-provider";
import { useOnboardingSnapshot } from "@/hooks/use-onboarding";
import { isOnboardingHeld, subscribeOnboardingHold } from "@/lib/onboarding/onboarding-blockers";
import { onboardingActions } from "@/lib/onboarding/onboarding-actions";
import { checklistProgress } from "@/lib/onboarding/onboarding-state";
import { cn } from "@/lib/utils";

/**
 * Inline welcome on the signed-in home, below the composer. Shown to new accounts until it is
 * dismissed, the Guide is opened from it, or the first steps are all done. It never overlays
 * anything and never takes focus.
 */
export function WelcomeCard({ className }: { className?: string }) {
  const { autoEligible, signedIn, openGuide } = useOnboarding();
  const { status, persistent, recovered, state } = useOnboardingSnapshot();
  const voice = useContext(VoiceSessionContext);
  const held = useSyncExternalStore(subscribeOnboardingHold, isOnboardingHeld, () => true);
  const voiceLive = Boolean(voice?.connected || voice?.connecting);

  const visible =
    signedIn &&
    autoEligible &&
    status === "ready" &&
    persistent &&
    !recovered &&
    state.welcomeDismissedAt == null &&
    !checklistProgress(state).complete &&
    !voiceLive &&
    !held;

  if (!visible) return null;

  return (
    <aside
      aria-labelledby="welcome-card-title"
      className={cn(
        glass({ opaque: true }),
        "relative w-full rounded-2xl px-inset-lg py-inset-lg pr-12",
        "motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-1",
        className
      )}
      data-welcome-card
    >
      <h2
        className="flex items-center gap-inline-sm text-sm font-medium text-foreground"
        id="welcome-card-title"
      >
        <Sparkles aria-hidden className="size-3.5 text-lumen" strokeWidth={1.75} />
        Welcome to Organic
      </h2>
      <p className="mt-stack-xs text-sm leading-relaxed text-muted-foreground">
        Type an idea above and Organic opens the right place for it: a recent thread that matches,
        or a fresh chat. The sidebar holds every other surface, from research to meal plans.
      </p>
      <Button
        className="mt-stack-md h-9 px-3 text-xs sm:h-8"
        size="sm"
        type="button"
        variant="secondary"
        onClick={() => {
          onboardingActions.dismissWelcome();
          openGuide("start");
        }}
      >
        Open the Guide
      </Button>
      <Button
        aria-label="Dismiss welcome"
        className="absolute top-2 right-2 size-9 text-muted-foreground hover:text-foreground"
        size="icon"
        type="button"
        variant="ghost"
        onClick={() => onboardingActions.dismissWelcome()}
      >
        <X className="size-4" />
      </Button>
    </aside>
  );
}
