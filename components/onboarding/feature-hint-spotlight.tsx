"use client";

import { useLayoutEffect, useState } from "react";

import type { FeatureHintBackdrop } from "@/lib/onboarding/feature-hints";
import { cn } from "@/lib/utils";

const SPOTLIGHT_PAD_PX = 8;

type FeatureHintSpotlightProps = {
  anchor: HTMLElement | null;
  visible: boolean;
  backdrop?: FeatureHintBackdrop;
};

const BLUR_PANEL_CLASS =
  "absolute bg-black/30 backdrop-blur-[6px] dark:bg-black/45";

export function FeatureHintSpotlight({
  anchor,
  visible,
  backdrop = "dim",
}: FeatureHintSpotlightProps) {
  const [rect, setRect] = useState<DOMRect | null>(null);

  useLayoutEffect(() => {
    if (!visible || !anchor) {
      setRect(null);

      return;
    }

    const update = () => setRect(anchor.getBoundingClientRect());

    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);

    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [anchor, visible]);

  if (!visible || !rect) return null;

  const top = rect.top - SPOTLIGHT_PAD_PX;
  const left = rect.left - SPOTLIGHT_PAD_PX;
  const width = rect.width + SPOTLIGHT_PAD_PX * 2;
  const height = rect.height + SPOTLIGHT_PAD_PX * 2;
  const bottom = top + height;
  const right = left + width;

  const ringClass = cn(
    "absolute rounded-xl ring-2 ring-lumen/70 ring-offset-2 ring-offset-transparent"
  );

  if (backdrop === "blur") {
    // Four blur panels around the hole — mask + backdrop-filter leaves the cutout blurred.
    return (
      <div aria-hidden className="pointer-events-none fixed inset-0 z-[205]">
        {top > 0 ? (
          <div className={BLUR_PANEL_CLASS} style={{ top: 0, left: 0, right: 0, height: top }} />
        ) : null}
        {bottom < window.innerHeight ? (
          <div
            className={BLUR_PANEL_CLASS}
            style={{ top: bottom, left: 0, right: 0, bottom: 0 }}
          />
        ) : null}
        {left > 0 && height > 0 ? (
          <div className={BLUR_PANEL_CLASS} style={{ top, left: 0, width: left, height }} />
        ) : null}
        {right < window.innerWidth && height > 0 ? (
          <div
            className={BLUR_PANEL_CLASS}
            style={{ top, left: right, right: 0, height }}
          />
        ) : null}
        <div className={ringClass} style={{ top, left, width, height }} />
      </div>
    );
  }

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-[205]">
      <div
        className={cn(
          ringClass,
          "shadow-[0_0_0_9999px_rgba(0,0,0,0.52)] dark:shadow-[0_0_0_9999px_rgba(0,0,0,0.68)]"
        )}
        style={{ top, left, width, height }}
      />
    </div>
  );
}
