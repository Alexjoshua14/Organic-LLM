"use client";

import type { FeatureTipInstance } from "@/lib/onboarding/feature-tip-registry";

import { usePathname } from "next/navigation";
import { Popover } from "radix-ui";
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { toast } from "sonner";

import { FeatureTipCard } from "./feature-tip-card";
import { useOnboarding } from "./onboarding-context";

import { glass } from "@/components/design-system/primitives";
import {
  useFeatureTipInstances,
  useIsApplePlatform,
  useOnboardingSnapshot,
} from "@/hooks/use-onboarding";
import {
  featureTipBody,
  getAutoFeatureTip,
  type AutoFeatureTipDefinition,
  type AutoFeatureTipId,
} from "@/lib/onboarding/feature-tips";
import { onboardingActions } from "@/lib/onboarding/onboarding-actions";
import { getOnboardingSnapshot } from "@/lib/onboarding/onboarding-store";
import {
  isAnchorPresentable,
  isBlockingOverlayOpen,
  type AnchorProbe,
  type OverlayProbe,
} from "@/lib/onboarding/presentability";
import { selectTipCandidates, tipPacingBlock } from "@/lib/onboarding/tip-pacing";
import { TIP_TIMING, TIP_Z_INDEX_CLASS, type TipTiming } from "@/lib/onboarding/tip-timing";
import { cn } from "@/lib/utils";

/** Any of these counts as the person being busy; tips wait for a pause. */
const ACTIVITY_EVENTS = [
  "pointerdown",
  "keydown",
  "wheel",
  "touchstart",
  "input",
  "scroll",
] as const;

const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Why a tip closed. Explicit and acted are permanent; implicit hides it for this tab session and
 * becomes permanent the second time; off turns every tip off; silent records nothing.
 */
type CloseReason = "explicit" | "acted" | "implicit" | "off" | "silent";

type ActiveTip = {
  id: AutoFeatureTipId;
  instanceKey: string;
  version: number;
  element: HTMLElement;
  pathname: string;
  title: string;
  body: string;
};

/**
 * What the popover positions against. Usually the control itself; with `clearOf`, a virtual rect
 * that keeps the control's horizontal span but sits on the ancestor's edge, so the tip never
 * covers that ancestor (the composer's text box). `contextElement` lets Floating UI keep tracking
 * scroll and resize of the real control.
 */
function tipAnchor(element: HTMLElement, definition: AutoFeatureTipDefinition) {
  const container = definition.clearOf ? element.closest(definition.clearOf) : null;

  if (!container || (definition.side !== "top" && definition.side !== "bottom")) return element;

  return {
    contextElement: element,
    getBoundingClientRect: () => {
      const own = element.getBoundingClientRect();
      const outer = container.getBoundingClientRect();
      const y = definition.side === "top" ? outer.top : outer.bottom;

      return DOMRect.fromRect({ x: own.left, y, width: own.width, height: 0 });
    },
  };
}

type FeatureTipLayerProps = {
  /** Injectable for tests (JSDOM has no layout). */
  anchorProbe?: AnchorProbe;
  overlayProbe?: OverlayProbe;
  /** Injectable for tests; production uses `TIP_TIMING`. */
  timing?: TipTiming;
};

/**
 * Shows at most one automatic feature tip, anchored to its control with a non-modal Radix popover.
 * It waits until the route has settled, the person has paused, nothing else is open and the
 * anchor is actually visible, and it respects the pacing in `tip-pacing.ts`. While nothing is
 * waiting to show it attaches no listeners and runs no timers.
 */
export function FeatureTipLayer({
  anchorProbe = isAnchorPresentable,
  overlayProbe = isBlockingOverlayOpen,
  timing = TIP_TIMING,
}: FeatureTipLayerProps) {
  const pathname = usePathname() ?? "";
  const onboarding = useOnboardingSnapshot();
  const instances = useFeatureTipInstances();
  const { autoEligible, guideOpen } = useOnboarding();
  const apple = useIsApplePlatform();
  const titleId = useId();
  const bodyId = useId();

  const [tip, setTip] = useState<ActiveTip | null>(null);
  const [open, setOpen] = useState(false);
  const [announcement, setAnnouncement] = useState("");

  const openRef = useRef(false);
  const tipRef = useRef<ActiveTip | null>(null);
  const visitRef = useRef({ pathname, enteredAt: 0, shown: false });
  const lastActivityRef = useRef(0);
  const focusReturnRef = useRef<HTMLElement | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const instancesRef = useRef(instances);

  instancesRef.current = instances;

  useEffect(() => {
    visitRef.current = { pathname, enteredAt: Date.now(), shown: false };
  }, [pathname]);

  const candidates = useMemo(
    () =>
      onboarding.status === "ready"
        ? selectTipCandidates(instances, {
            pathname,
            state: onboarding.state,
            sessionHiddenTips: onboarding.sessionHiddenTips,
            autoEligible,
          })
        : [],
    [autoEligible, instances, onboarding, pathname]
  );
  const candidatesRef = useRef<FeatureTipInstance[]>(candidates);

  candidatesRef.current = candidates;

  const candidateKey = candidates.map((candidate) => candidate.key).join("|");
  const waiting = !open && !guideOpen && candidates.length > 0;

  const close = useCallback((reason: CloseReason) => {
    const active = tipRef.current;

    if (!openRef.current || !active) return;
    openRef.current = false;

    switch (reason) {
      case "explicit":
        onboardingActions.tipSeen(active.id, active.version, "dismissed");
        break;
      case "acted":
        onboardingActions.tipSeen(active.id, active.version, "acted");
        break;
      case "implicit":
        onboardingActions.tipClosedImplicitly(active.id, active.version);
        break;
      case "off":
        onboardingActions.tipSeen(active.id, active.version, "off");
        onboardingActions.setTipsEnabled(false);
        toast("Tips are off", {
          description: "Turn them back on from the Guide or Quick settings.",
          action: { label: "Undo", onClick: () => onboardingActions.setTipsEnabled(true) },
        });
        break;
      case "silent":
        break;
    }

    // Return focus only if it was inside the tip, and only to an element that still exists.
    const content = contentRef.current;

    if (content && content.contains(document.activeElement)) {
      const target = focusReturnRef.current;

      if (target?.isConnected) target.focus({ preventScroll: true });
      else (document.activeElement as HTMLElement | null)?.blur();
    }

    focusReturnRef.current = null;
    setAnnouncement("");
    setOpen(false);
  }, []);

  const show = useCallback(
    (candidate: FeatureTipInstance, element: HTMLElement) => {
      const definition = getAutoFeatureTip(candidate.id);
      const body = featureTipBody(definition, apple);
      const active: ActiveTip = {
        id: candidate.id,
        instanceKey: candidate.key,
        version: definition.version,
        element,
        pathname: visitRef.current.pathname,
        title: definition.title,
        body,
      };

      visitRef.current.shown = true;
      tipRef.current = active;
      openRef.current = true;
      onboardingActions.tipShown();
      setTip(active);
      setOpen(true);
      setAnnouncement(`Tip: ${definition.title}. ${body} Press Escape to dismiss.`);
    },
    [apple]
  );

  // Waiting: one shared listener set and one timer, only while a tip is eligible.
  useEffect(() => {
    if (!waiting) return;

    // The moment a tip becomes relevant counts as activity, so it never fires mid-action.
    lastActivityRef.current = Date.now();

    const markActive = () => {
      lastActivityRef.current = Date.now();
    };
    const listenerOptions: AddEventListenerOptions = { capture: true, passive: true };

    for (const type of ACTIVITY_EVENTS) window.addEventListener(type, markActive, listenerOptions);

    let timer = 0;
    const tick = () => {
      const now = Date.now();
      const blocked = tipPacingBlock(
        {
          now,
          routeEnteredAt: visitRef.current.enteredAt,
          lastActivityAt: lastActivityRef.current,
          documentHidden: document.hidden,
          shownThisVisit: visitRef.current.shown,
          tipLog: getOnboardingSnapshot().state.tipLog,
        },
        timing
      );

      if (!blocked && !overlayProbe(document)) {
        for (const candidate of candidatesRef.current) {
          const element = candidate.getElement();

          if (element && anchorProbe(element)) {
            show(candidate, element);

            return;
          }
        }
      }

      timer = window.setTimeout(tick, timing.pollMs);
    };

    timer = window.setTimeout(tick, timing.pollMs);

    return () => {
      window.clearTimeout(timer);
      for (const type of ACTIVITY_EVENTS) {
        window.removeEventListener(type, markActive, listenerOptions);
      }
    };
  }, [anchorProbe, candidateKey, overlayProbe, show, timing, waiting]);

  // Visible: close when the anchor goes away, its moment passes, or another layer opens.
  useEffect(() => {
    if (!open || !tip) return;

    let failedChecks = 0;
    const check = () => {
      if (overlayProbe(document)) return close("implicit");

      const instance = instancesRef.current.find((entry) => entry.key === tip.instanceKey);

      if (!instance?.showWhen || !tip.element.isConnected) return close("implicit");

      // Two failed checks in a row (about a second) tolerate a layout animation in between.
      failedChecks = anchorProbe(tip.element) ? 0 : failedChecks + 1;
      if (failedChecks >= 2) close("implicit");
    };

    const interval = window.setInterval(check, timing.recheckMs);
    // Portals mount as body children; react to a dialog or menu opening right away.
    const observer = new MutationObserver(() => {
      if (overlayProbe(document)) close("implicit");
    });

    observer.observe(document.body, {
      childList: true,
      attributes: true,
      attributeFilter: ["data-scroll-locked"],
    });

    // Using the control the tip points at (pointer or keyboard) means it did its job.
    const onAnchorClick = () => close("acted");

    tip.element.addEventListener("click", onAnchorClick, true);

    return () => {
      window.clearInterval(interval);
      observer.disconnect();
      tip.element.removeEventListener("click", onAnchorClick, true);
    };
  }, [anchorProbe, close, open, overlayProbe, timing, tip]);

  // Leaving the route, turning tips off, or the instance unmounting ends the tip.
  useEffect(() => {
    if (!openRef.current || !tipRef.current) return;
    if (tipRef.current.pathname !== pathname) close("implicit");
    else if (!onboarding.state.tipsEnabled || onboarding.status !== "ready") close("silent");
  }, [close, onboarding, pathname]);

  // While open, the anchor's control is described by the tip for screen readers.
  useEffect(() => {
    if (!open || !tip) return;

    const target = tip.element.matches(FOCUSABLE)
      ? tip.element
      : tip.element.querySelector<HTMLElement>(FOCUSABLE);

    if (!target) return;

    const previous = target.getAttribute("aria-describedby");

    target.setAttribute("aria-describedby", previous ? `${previous} ${bodyId}` : bodyId);

    return () => {
      if (previous == null) target.removeAttribute("aria-describedby");
      else target.setAttribute("aria-describedby", previous);
    };
  }, [bodyId, open, tip]);

  const definition = tip ? getAutoFeatureTip(tip.id) : null;
  const anchorRef = useMemo(
    () => ({ current: tip && definition ? tipAnchor(tip.element, definition) : null }),
    [definition, tip]
  );

  return (
    <>
      <div aria-atomic aria-live="polite" className="sr-only" role="status">
        {announcement}
      </div>
      {tip && definition ? (
        <Popover.Root
          modal={false}
          open={open}
          onOpenChange={(next) => {
            if (!next) close("implicit");
          }}
        >
          <Popover.Anchor virtualRef={anchorRef} />
          <Popover.Portal>
            <Popover.Content
              ref={contentRef}
              hideWhenDetached
              aria-describedby={bodyId}
              aria-labelledby={titleId}
              align={definition.align}
              className={cn(
                glass({ opaque: true }),
                TIP_Z_INDEX_CLASS,
                "w-[min(20rem,calc(100vw-2rem))] rounded-xl p-inset-lg outline-none",
                "shadow-[0_18px_48px_-24px_rgb(0_0_0/0.45)] dark:shadow-[0_18px_48px_-20px_rgb(0_0_0/0.8)]",
                "ring-1 ring-inset ring-white/50 dark:ring-white/10",
                "data-[state=open]:animate-in data-[state=open]:fade-in-0",
                "motion-safe:data-[state=open]:data-[side=top]:slide-in-from-bottom-1",
                "motion-safe:data-[state=open]:data-[side=bottom]:slide-in-from-top-1",
                "motion-safe:data-[state=open]:data-[side=left]:slide-in-from-right-1",
                "motion-safe:data-[state=open]:data-[side=right]:slide-in-from-left-1",
                "data-[state=closed]:animate-out data-[state=closed]:fade-out-0",
                "data-[state=open]:[--tw-animation-duration:var(--tip-enter-ms)] data-[state=closed]:[--tw-animation-duration:var(--tip-exit-ms)]"
              )}
              collisionPadding={12}
              data-feature-tip={tip.id}
              side={definition.side}
              sideOffset={10}
              style={
                {
                  "--tip-enter-ms": `${timing.enterMs}ms`,
                  "--tip-exit-ms": `${timing.exitMs}ms`,
                } as CSSProperties
              }
              updatePositionStrategy="always"
              onCloseAutoFocus={(event) => event.preventDefault()}
              onEscapeKeyDown={() => close("explicit")}
              onFocusCapture={(event) => {
                const from = event.relatedTarget;

                if (
                  from instanceof HTMLElement &&
                  !event.currentTarget.contains(from) &&
                  !focusReturnRef.current
                ) {
                  focusReturnRef.current = from;
                }
              }}
              onFocusOutside={(event) => event.preventDefault()}
              onOpenAutoFocus={(event) => event.preventDefault()}
              onPointerDownOutside={(event) => {
                const target = event.detail.originalEvent.target;

                // A press on the anchor itself is handled as "acted" by its click listener.
                if (target instanceof Node && tip.element.contains(target)) {
                  event.preventDefault();

                  return;
                }

                close("implicit");
              }}
            >
              <FeatureTipCard
                body={tip.body}
                bodyId={bodyId}
                title={tip.title}
                titleId={titleId}
                onGotIt={() => close("explicit")}
                onTurnOff={() => close("off")}
              />
            </Popover.Content>
          </Popover.Portal>
        </Popover.Root>
      ) : null}
    </>
  );
}
