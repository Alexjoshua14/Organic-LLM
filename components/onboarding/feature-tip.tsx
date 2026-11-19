"use client";

import type { AutoFeatureTipId } from "@/lib/onboarding/feature-tips";

import { useCallback, useEffect, useId, useRef, type ReactNode } from "react";

import { registerFeatureTip, unregisterFeatureTip } from "@/lib/onboarding/feature-tip-registry";

type FeatureTipProps = {
  id: AutoFeatureTipId;
  children: ReactNode;
  /** The moment the tip becomes relevant (e.g. after the first reply). Defaults to always. */
  showWhen?: boolean;
};

/**
 * Marks its child as the anchor for an automatic feature tip. Renders a `display: contents`
 * wrapper, so layout is unchanged and the child needs no ref forwarding: the anchor is the
 * wrapper's first element. The global `FeatureTipLayer` decides whether and when to show the tip.
 */
export function FeatureTip({ id, children, showWhen = true }: FeatureTipProps) {
  const key = useId();
  const wrapperRef = useRef<HTMLDivElement>(null);

  const getElement = useCallback(() => {
    const element = wrapperRef.current?.firstElementChild;

    return element instanceof HTMLElement ? element : null;
  }, []);

  useEffect(() => {
    registerFeatureTip({ key, id, showWhen, getElement });
  }, [getElement, id, key, showWhen]);

  useEffect(() => () => unregisterFeatureTip(key), [key]);

  return (
    <div ref={wrapperRef} className="contents" data-feature-tip-anchor={id}>
      {children}
    </div>
  );
}
