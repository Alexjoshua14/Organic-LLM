"use client";

import type { FeatureHintId, FeatureHintSide } from "@/lib/onboarding/feature-hints";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";

import { FeatureHintPopoverCard } from "./feature-hint-popover-card";
import { FeatureHintSpotlight } from "./feature-hint-spotlight";
import { useFeatureHintNavigationSettled } from "./use-feature-hint-navigation-settled";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/third-party/ui/sheet";
import {
  useExplicitFeatureGuideRequested,
  useFeatureHintSession,
  useSessionDismissedFeatureHintIds,
} from "@/hooks/use-feature-hint-session";
import {
  dismissFeatureHint,
  readFeatureHintDismissRecord,
} from "@/lib/onboarding/feature-hint-storage";
import {
  consumeExplicitFeatureGuideRequest,
} from "@/lib/onboarding/feature-hint-explicit-request";
import { shouldBlockAutoFeatureHints } from "@/lib/onboarding/feature-hint-guide-policy";
import {
  featureHintQueuePosition,
  getEligibleFeatureHintQueue,
} from "@/lib/onboarding/feature-hint-queue";
import { useFeatureHintRegistrations } from "@/lib/onboarding/feature-hint-context";
import {
  clearFeatureHintSessionBreath,
  clearSessionFeatureHintDismissals,
  recordFeatureHintSessionDismiss,
  recordSessionFeatureHintDismiss,
  syncFeatureHintSessionPath,
} from "@/lib/onboarding/feature-hint-session";
import { getFeatureHint } from "@/lib/onboarding/feature-hints";
import { useReplayFeatureHints } from "@/hooks/use-replay-feature-hints";
import { useModalOverlayOpen } from "@/hooks/use-modal-overlay-open";
import { cn } from "@/lib/utils";
import { usePathname } from "next/navigation";

const CALLOUT_GAP_PX = 12;
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

function computePopoverStyle(
  anchor: DOMRect,
  side: FeatureHintSide,
  align: "start" | "center" | "end",
  popover: DOMRect
): CSSProperties {
  const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

  let top = 0;
  let left = 0;

  if (side === "top") {
    top = anchor.top - popover.height - CALLOUT_GAP_PX;
    left =
      align === "start"
        ? anchor.left
        : align === "end"
          ? anchor.right - popover.width
          : anchor.left + anchor.width / 2 - popover.width / 2;
  } else if (side === "bottom") {
    top = anchor.bottom + CALLOUT_GAP_PX;
    left =
      align === "start"
        ? anchor.left
        : align === "end"
          ? anchor.right - popover.width
          : anchor.left + anchor.width / 2 - popover.width / 2;
  } else if (side === "left") {
    left = anchor.left - popover.width - CALLOUT_GAP_PX;
    top =
      align === "start"
        ? anchor.top
        : align === "end"
          ? anchor.bottom - popover.height
          : anchor.top + anchor.height / 2 - popover.height / 2;
  } else {
    left = anchor.right + CALLOUT_GAP_PX;
    top =
      align === "start"
        ? anchor.top
        : align === "end"
          ? anchor.bottom - popover.height
          : anchor.top + anchor.height / 2 - popover.height / 2;
  }

  return {
    position: "fixed",
    top: clamp(top, VIEWPORT_MARGIN_PX, window.innerHeight - popover.height - VIEWPORT_MARGIN_PX),
    left: clamp(left, VIEWPORT_MARGIN_PX, window.innerWidth - popover.width - VIEWPORT_MARGIN_PX),
    width: popover.width,
  };
}

export function FeatureHintLayer() {
  const registrations = useFeatureHintRegistrations();
  const replayFeatureHints = useReplayFeatureHints();
  const pathname = usePathname() ?? "";
  const navigationSettled = useFeatureHintNavigationSettled();
  const hintSession = useFeatureHintSession(pathname);
  const sessionDismissedIds = useSessionDismissedFeatureHintIds();
  const explicitGuideRequested = useExplicitFeatureGuideRequested();
  const modalOverlayOpen = useModalOverlayOpen();
  const narrow = useNarrowViewport();
  const [hydrated, setHydrated] = useState(false);
  const [dismissRecord, setDismissRecord] = useState(() =>
    typeof window === "undefined" ? {} : readFeatureHintDismissRecord(window.localStorage)
  );
  const popoverRef = useRef<HTMLDivElement>(null);
  const [popoverStyle, setPopoverStyle] = useState<CSSProperties | null>(null);
  const toastShownRef = useRef<FeatureHintId | null>(null);
  const prevReplayFeatureHintsRef = useRef(replayFeatureHints);

  useEffect(() => {
    setHydrated(true);
    setDismissRecord(readFeatureHintDismissRecord(window.localStorage));
    syncFeatureHintSessionPath(pathname);
  }, [pathname]);

  useEffect(() => {
    const wasReplay = prevReplayFeatureHintsRef.current;

    prevReplayFeatureHintsRef.current = replayFeatureHints;

    if (!replayFeatureHints || wasReplay) return;

    toastShownRef.current = null;
    clearFeatureHintSessionBreath(pathname);
    clearSessionFeatureHintDismissals();
  }, [pathname, replayFeatureHints]);

  useEffect(() => {
    if (!hydrated || explicitGuideRequested) return;

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target;

      if (!(target instanceof Element)) return;
      if (target.closest("[data-feature-hint-overlay]")) return;

      clearFeatureHintSessionBreath(pathname);
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;

      const target = event.target;

      if (target instanceof Element && target.closest("[data-feature-hint-overlay]")) return;

      clearFeatureHintSessionBreath(pathname);
    };

    window.addEventListener("pointerdown", onPointerDown, true);
    window.addEventListener("keydown", onKeyDown, true);

    return () => {
      window.removeEventListener("pointerdown", onPointerDown, true);
      window.removeEventListener("keydown", onKeyDown, true);
    };
  }, [explicitGuideRequested, hydrated, pathname]);

  const guideBreathBlocked = shouldBlockAutoFeatureHints(hintSession, {
    replayFeatureHints,
    explicitGuideRequested,
  });

  const queueContext = useMemo(
    () => ({
      hydrated,
      guideBreathBlocked,
      pathname,
      navigationSettled,
      registrations,
      dismissRecord,
      replayFeatureHints,
      sessionDismissedIds,
    }),
    [
      dismissRecord,
      guideBreathBlocked,
      hydrated,
      navigationSettled,
      pathname,
      registrations,
      replayFeatureHints,
      sessionDismissedIds,
    ]
  );

  const hintQueue = useMemo(() => {
    if (modalOverlayOpen) return [];

    return getEligibleFeatureHintQueue(queueContext);
  }, [modalOverlayOpen, queueContext]);

  const activeId = hintQueue[0] ?? null;

  const queuePosition = useMemo(
    () => featureHintQueuePosition(hintQueue, activeId),
    [activeId, hintQueue]
  );

  useEffect(() => {
    if (!activeId || !explicitGuideRequested) return;

    consumeExplicitFeatureGuideRequest();
  }, [activeId, explicitGuideRequested]);

  const activeDefinition = activeId ? getFeatureHint(activeId) : null;
  const activeRegistration = activeId ? registrations.get(activeId) : undefined;
  const anchorEl = activeRegistration?.anchorRef.current ?? null;

  const dismissActive = useCallback(() => {
    if (!activeId || !activeDefinition) return;

    const next = dismissFeatureHint(window.localStorage, activeId, activeDefinition.version);

    setDismissRecord(next);
    recordSessionFeatureHintDismiss(activeId);
    recordFeatureHintSessionDismiss(pathname);
    toastShownRef.current = null;
  }, [activeDefinition, activeId, pathname]);

  const showSpotlight =
    activeDefinition?.presentation === "spotlight" && Boolean(anchorEl) && !narrow;
  const showPopover =
    activeDefinition?.presentation === "spotlight" && Boolean(anchorEl) && !narrow;
  const showDrawer =
    activeDefinition?.presentation === "spotlight" && Boolean(anchorEl) && narrow;

  useLayoutEffect(() => {
    if (!showPopover || !anchorEl || !popoverRef.current) {
      setPopoverStyle(null);

      return;
    }

    const update = () => {
      if (!popoverRef.current) return;

      setPopoverStyle(
        computePopoverStyle(
          anchorEl.getBoundingClientRect(),
          activeDefinition?.side ?? "top",
          activeDefinition?.align ?? "start",
          popoverRef.current.getBoundingClientRect()
        )
      );
    };

    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);

    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [activeDefinition?.align, activeDefinition?.side, anchorEl, showPopover, activeId]);

  useEffect(() => {
    if (!activeId || !activeDefinition || activeDefinition.presentation !== "toast") return;
    if (toastShownRef.current === activeId) return;

    toastShownRef.current = activeId;
    const queueLabel =
      queuePosition != null ? `*${queuePosition.index}* | · | ${queuePosition.total} — ` : "";

    toast(activeDefinition.title, {
      description: `${queueLabel}${activeDefinition.body}`,
      duration: 12_000,
      action: {
        label: "Got it",
        onClick: dismissActive,
      },
      onDismiss: dismissActive,
    });
  }, [activeDefinition, activeId, dismissActive, queuePosition]);

  useEffect(() => {
    if (!activeId || activeDefinition?.presentation !== "spotlight") return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") dismissActive();
    };

    window.addEventListener("keydown", onKeyDown);

    return () => window.removeEventListener("keydown", onKeyDown);
  }, [activeDefinition?.presentation, activeId, dismissActive]);

  if (!activeId || !activeDefinition || activeDefinition.presentation === "toast") {
    return null;
  }

  return (
    <>
      {typeof document !== "undefined"
        ? createPortal(
            <FeatureHintSpotlight
              anchor={anchorEl}
              backdrop={activeDefinition?.contextualBackdrop}
              visible={showSpotlight}
            />,
            document.body
          )
        : null}

      {showPopover && typeof document !== "undefined"
        ? createPortal(
            <>
              <button
                aria-label="Dismiss tip"
                className="fixed inset-0 z-[206] cursor-default bg-transparent"
                data-feature-hint-overlay
                type="button"
                onClick={dismissActive}
              />
              <div
                ref={popoverRef}
                className={cn(
                  "pointer-events-auto z-[210]",
                  activeId === "experience-rail"
                    ? "w-[min(22rem,calc(100vw-2rem))]"
                    : "w-[min(18rem,calc(100vw-2rem))]",
                  popoverStyle ? "opacity-100" : "opacity-0"
                )}
                data-feature-hint-overlay
                style={
                  popoverStyle ?? { position: "fixed", top: -9999, left: -9999, width: 288 }
                }
              >
                <FeatureHintPopoverCard
                  body={activeDefinition.body}
                  hintId={activeId}
                  queueIndex={queuePosition?.index}
                  queueTotal={queuePosition?.total}
                  title={activeDefinition.title}
                  onDismiss={dismissActive}
                />
              </div>
            </>,
            document.body
          )
        : null}

      <Sheet open={showDrawer} onOpenChange={(open) => !open && dismissActive()}>
        <SheetContent
          overlayPriority
          className="rounded-t-2xl border-border/60 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-2"
          data-feature-hint-overlay
          side="bottom"
        >
          <SheetHeader className="sr-only">
            <SheetTitle>{activeDefinition.title}</SheetTitle>
            <SheetDescription>{activeDefinition.body}</SheetDescription>
          </SheetHeader>
          <FeatureHintPopoverCard
            body={activeDefinition.body}
            className="border-0 shadow-none"
            hintId={activeId}
            queueIndex={queuePosition?.index}
            queueTotal={queuePosition?.total}
            title={activeDefinition.title}
            onDismiss={dismissActive}
          />
        </SheetContent>
      </Sheet>
    </>
  );
}
