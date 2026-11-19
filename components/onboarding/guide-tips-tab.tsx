"use client";

import { RotateCcw } from "lucide-react";
import { useState } from "react";

import { useOnboarding } from "./onboarding-context";

import { Switch } from "@/components/design-system/switch";
import { Button } from "@/components/third-party/ui/button";
import { useIsAdmin } from "@/hooks/use-is-admin";
import { useIsApplePlatform, useOnboardingSnapshot } from "@/hooks/use-onboarding";
import { featureTipBody, guideTipList } from "@/lib/onboarding/feature-tips";
import { onboardingActions } from "@/lib/onboarding/onboarding-actions";

function TipControls() {
  const { state } = useOnboardingSnapshot();
  const [replayed, setReplayed] = useState(false);

  return (
    <section className="flex flex-col gap-stack-md rounded-xl border border-border/50 px-inset-lg py-inset-md">
      <div className="flex items-center justify-between gap-inline-md">
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground" id="guide-tips-switch">
            Feature tips
          </p>
          <p className="text-xs leading-relaxed text-muted-foreground">
            Short pointers that appear while you’re idle, at most twice a day.
          </p>
        </div>
        <Switch
          aria-labelledby="guide-tips-switch"
          isSelected={state.tipsEnabled}
          onValueChange={(enabled) => onboardingActions.setTipsEnabled(enabled)}
        />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-inline-md border-t border-border/30 pt-stack-md">
        <p className="min-w-0 flex-1 text-xs leading-relaxed text-muted-foreground">
          {replayed
            ? "The welcome card and automatic tips will appear again when relevant."
            : "Show the welcome card and automatic tips again. Your first-step progress stays."}
        </p>
        <Button
          className="h-11 gap-1.5 px-3 text-xs sm:h-8"
          disabled={replayed}
          size="sm"
          type="button"
          variant="secondary"
          onClick={async () => {
            if (await onboardingActions.replay()) setReplayed(true);
          }}
        >
          <RotateCcw aria-hidden className="size-3.5" />
          Replay onboarding
        </Button>
      </div>
    </section>
  );
}

/** Guide → Tips: every tip, readable any time, plus the tips switch and replay. */
export function GuideTipsTab() {
  const { signedIn } = useOnboarding();
  const apple = useIsApplePlatform();
  const isAdmin = useIsAdmin() === true;

  return (
    <div className="flex flex-col gap-stack-2xl px-5 py-5 sm:px-6">
      {signedIn ? <TipControls /> : null}
      <ul className="divide-y divide-border/30">
        {guideTipList({ isAdmin }).map((tip) => (
          <li key={tip.id} className="flex flex-col gap-stack-xs py-stack-md first:pt-0 last:pb-0">
            <p className="text-2xs font-medium uppercase tracking-[0.16em] text-muted-foreground/80">
              {tip.where}
            </p>
            <p className="text-sm font-medium text-foreground">{tip.title}</p>
            <p className="text-xs leading-relaxed text-muted-foreground">
              {featureTipBody(tip, apple)}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}
