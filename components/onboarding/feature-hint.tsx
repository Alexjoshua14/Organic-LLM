"use client";

import type { FeatureHintId } from "@/lib/onboarding/feature-hints";

import { Slot } from "@radix-ui/react-slot";
import { useEffect, useRef, type ReactNode } from "react";

import { useFeatureHintRegistry } from "@/lib/onboarding/feature-hint-context";

type FeatureHintProps = {
  id: FeatureHintId;
  children: ReactNode;
  /** Gate visibility until a product condition is met (e.g. first assistant turn). */
  showWhen?: boolean;
  className?: string;
};

/**
 * Registers an anchor for the global {@link FeatureHintLayer} — does not alter layout.
 * The layer renders spotlight + popover/drawer/toast without wrapping or shifting UI.
 */
export function FeatureHint({ id, children, showWhen = true, className }: FeatureHintProps) {
  const { register, unregister } = useFeatureHintRegistry();
  const anchorRef = useRef<HTMLElement>(null);

  useEffect(() => {
    register({ id, showWhen, anchorRef });

    return () => unregister(id);
  }, [id, register, showWhen, unregister]);

  return (
    <Slot ref={anchorRef} className={className}>
      {children}
    </Slot>
  );
}

export { useFeatureHint } from "./use-feature-hint";
