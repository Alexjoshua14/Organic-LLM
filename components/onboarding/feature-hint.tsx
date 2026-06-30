"use client";

import type { FeatureHintId, FeatureHintSide } from "@/lib/onboarding/feature-hints";

import { Slot } from "@radix-ui/react-slot";
import { Sparkles, X } from "lucide-react";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

import { glassPreview } from "@/components/design-system/primitives";
import { Button } from "@/components/third-party/ui/button";
import {
  dismissFeatureHint,
  isFeatureHintDismissed,
  readFeatureHintDismissRecord,
} from "@/lib/onboarding/feature-hint-storage";
import {
  getFeatureHint,
  isFeatureHintEnabledInCode,
} from "@/lib/onboarding/feature-hints";
import { cn } from "@/lib/utils";

const CALLOUT_GAP_PX = 10;
const VIEWPORT_MARGIN_PX = 12;
const MOBILE_BREAKPOINT_PX = 640;

function useNarrowViewport() {
  const [narrow, setNarrow] = useState(false);

  useEffect(() => {
    const query = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT_PX - 1}px)`);
    const update = () => setNarrow(query.matches);

    update();
    query.addEventListener("change", update);

    return () => query.removeEventListener("change", update);
  }, []);

  return narrow;
}

function computeCalloutStyle(
  anchor: DOMRect,
  side: FeatureHintSide,
  align: "start" | "center" | "end",
  callout: DOMRect
): CSSProperties {
  const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

  let top = 0;
  let left = 0;

  if (side === "top") {
    top = anchor.top - callout.height - CALLOUT_GAP_PX;
    left =
      align === "start"
        ? anchor.left
        : align === "end"
          ? anchor.right - callout.width
          : anchor.left + anchor.width / 2 - callout.width / 2;
  } else if (side === "bottom") {
    top = anchor.bottom + CALLOUT_GAP_PX;
    left =
      align === "start"
        ? anchor.left
        : align === "end"
          ? anchor.right - callout.width
          : anchor.left + anchor.width / 2 - callout.width / 2;
  } else if (side === "left") {
    left = anchor.left - callout.width - CALLOUT_GAP_PX;
    top =
      align === "start"
        ? anchor.top
        : align === "end"
          ? anchor.bottom - callout.height
          : anchor.top + anchor.height / 2 - callout.height / 2;
  } else {
    left = anchor.right + CALLOUT_GAP_PX;
    top =
      align === "start"
        ? anchor.top
        : align === "end"
          ? anchor.bottom - callout.height
          : anchor.top + anchor.height / 2 - callout.height / 2;
  }

  const maxLeft = window.innerWidth - callout.width - VIEWPORT_MARGIN_PX;
  const maxTop = window.innerHeight - callout.height - VIEWPORT_MARGIN_PX;

  return {
    position: "fixed",
    top: clamp(top, VIEWPORT_MARGIN_PX, maxTop),
    left: clamp(left, VIEWPORT_MARGIN_PX, maxLeft),
    width: callout.width,
  };
}

function mobileBottomSheetStyle(): CSSProperties {
  return {
    position: "fixed",
    left: VIEWPORT_MARGIN_PX,
    right: VIEWPORT_MARGIN_PX,
    bottom: `max(${VIEWPORT_MARGIN_PX}px, env(safe-area-inset-bottom, 0px))`,
    width: "auto",
  };
}

export function useFeatureHint(id: FeatureHintId, showWhen = true) {
  const definition = getFeatureHint(id);
  const enabledInCode = isFeatureHintEnabledInCode(id);
  const [hydrated, setHydrated] = useState(false);
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    setHydrated(true);
    const record = readFeatureHintDismissRecord(window.localStorage);

    setDismissed(isFeatureHintDismissed(record, id, definition.version));
  }, [definition.version, id]);

  const dismiss = useCallback(() => {
    const next = dismissFeatureHint(window.localStorage, id, definition.version);

    setDismissed(isFeatureHintDismissed(next, id, definition.version));
  }, [definition.version, id]);

  const visible = hydrated && enabledInCode && showWhen && !dismissed;

  return { definition, visible, dismiss, enabledInCode };
}

type FeatureHintProps = {
  id: FeatureHintId;
  children: ReactNode;
  /** Gate visibility until a product condition is met (e.g. first assistant turn). */
  showWhen?: boolean;
  className?: string;
};

export function FeatureHint({ id, children, showWhen = true, className }: FeatureHintProps) {
  const { definition, visible, dismiss } = useFeatureHint(id, showWhen);
  const narrow = useNarrowViewport();
  const anchorRef = useRef<HTMLElement>(null);
  const calloutRef = useRef<HTMLDivElement>(null);
  const [calloutStyle, setCalloutStyle] = useState<CSSProperties | null>(null);
  const side = definition.side ?? "top";
  const align = definition.align ?? "start";
  const useBottomSheet = narrow && (definition.mobileBottomSheet ?? true);

  const updatePosition = useCallback(() => {
    const callout = calloutRef.current;

    if (!callout) return;

    if (useBottomSheet) {
      setCalloutStyle(mobileBottomSheetStyle());

      return;
    }

    const anchor = anchorRef.current;

    if (!anchor) return;

    setCalloutStyle(
      computeCalloutStyle(anchor.getBoundingClientRect(), side, align, callout.getBoundingClientRect())
    );
  }, [align, side, useBottomSheet]);

  useLayoutEffect(() => {
    if (!visible) {
      setCalloutStyle(null);

      return;
    }

    updatePosition();
    const frame = window.requestAnimationFrame(updatePosition);

    return () => window.cancelAnimationFrame(frame);
  }, [updatePosition, visible, definition.title, definition.body]);

  useEffect(() => {
    if (!visible) return;

    const onLayout = () => updatePosition();

    window.addEventListener("resize", onLayout);
    window.addEventListener("scroll", onLayout, true);

    return () => {
      window.removeEventListener("resize", onLayout);
      window.removeEventListener("scroll", onLayout, true);
    };
  }, [updatePosition, visible]);

  useEffect(() => {
    if (!visible) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") dismiss();
    };

    window.addEventListener("keydown", onKeyDown);

    return () => window.removeEventListener("keydown", onKeyDown);
  }, [dismiss, visible]);

  return (
    <>
      <Slot ref={anchorRef} className={className}>
        {children}
      </Slot>
      {visible && typeof document !== "undefined"
        ? createPortal(
            <>
              {useBottomSheet ? (
                <button
                  aria-label="Dismiss tip"
                  className="fixed inset-0 z-[210] bg-background/40 backdrop-blur-[2px]"
                  type="button"
                  onClick={dismiss}
                />
              ) : null}
              <div
                ref={calloutRef}
                aria-labelledby={`feature-hint-${id}-title`}
                className={cn(
                  glassPreview({ opaque: true, depth: "floating" }),
                  "pointer-events-auto z-[220] rounded-xl border border-border/70 p-3.5 sm:p-4",
                  useBottomSheet
                    ? "max-w-none shadow-2xl"
                    : "w-[min(18rem,calc(100vw-1.5rem))] shadow-xl",
                  calloutStyle ? "opacity-100" : "opacity-0"
                )}
                role="status"
                style={
                  calloutStyle ??
                  (useBottomSheet
                    ? mobileBottomSheetStyle()
                    : { position: "fixed", top: -9999, left: -9999, width: 288 })
                }
              >
                <div className="mb-2 flex items-start justify-between gap-2">
                  <div className="flex min-w-0 items-start gap-2">
                    <Sparkles aria-hidden className="mt-0.5 size-4 shrink-0 text-lumen" />
                    <p
                      className="text-sm font-medium leading-snug text-foreground"
                      id={`feature-hint-${id}-title`}
                    >
                      {definition.title}
                    </p>
                  </div>
                  <Button
                    aria-label="Dismiss tip"
                    className="size-7 shrink-0 text-muted-foreground"
                    size="icon"
                    type="button"
                    variant="ghost"
                    onClick={dismiss}
                  >
                    <X className="size-3.5" />
                  </Button>
                </div>
                <p className="mb-3 text-[13px] leading-relaxed text-muted-foreground sm:text-sm">
                  {definition.body}
                </p>
                <Button
                  className="h-9 w-full text-xs sm:text-sm"
                  size="sm"
                  type="button"
                  onClick={dismiss}
                >
                  Got it
                </Button>
              </div>
            </>,
            document.body
          )
        : null}
    </>
  );
}
