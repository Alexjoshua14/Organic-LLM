"use client";

import { useReducedMotion } from "framer-motion";
import { memo, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";

import { usePageVisible } from "@/components/hooks/use-page-visible";
import {
  LiquidChrome as LiquidChromeComponent,
  rgb01ToCss,
} from "@/components/third-party/reactbits/LiquidChrome/LiquidChrome";

interface AdaptiveLiquidChromeProps {
  speed?: number;
  dimOnHover?: boolean;
  dimIntensity?: number; // 0-1, how much to dim (0 = no dim, 1 = fully dimmed)
  /** When an element has data-dim-background="full", use this intensity (e.g. 0.6 → ~40% opacity). */
  dimIntensityFull?: number;
  /** Duration (ms) for transition into dimmed state (quick response to hover/focus). */
  dimTransitionMs?: number;
  /** Duration (ms) for phase 1 of brightening: dimmed → 65% opacity (quickish, still slower than dim). */
  to65TransitionMs?: number;
  /** Duration (ms) for phase 2 of brightening: 65% → 100% (slow, ease). */
  to100TransitionMs?: number;
  /** Called when dimmed state changes (e.g. for realtime display / debugging). */
  onDimChange?: (dimmed: boolean) => void;
  /** `viewport` fills 100dvh; `parent` fills the positioned parent (full scroll height). */
  cover?: "viewport" | "parent";
  /** Forwarded to LiquidChrome — mouse/touch ripple interaction. */
  interactive?: boolean;
}

type BrightnessState = "dimmed" | "to65" | "rest";

const DIM_TRIGGER_SELECTOR = "[data-dim-background]";

/**
 * AdaptiveLiquidChrome - A smart background that dims when hovering or when focus
 * is inside important UI elements (e.g. typing in an input), with intentional delay
 * before returning to rest once both hover and focus are gone.
 *
 * Usage: Add `data-dim-background` to any element that should trigger dimming.
 * Example: <Button data-dim-background>Click me</Button>
 * Focusable descendants (e.g. <Input>) keep the background dimmed while active.
 */
const EASE_SMOOTH = "cubic-bezier(0.25, 0.46, 0.45, 0.94)";

const BRIGHTEN_65 = 0.65; // first-phase target (65% opacity)

function subscribeToHtmlDarkClass(onStoreChange: () => void) {
  const observer = new MutationObserver(onStoreChange);

  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["class"],
  });

  return () => observer.disconnect();
}

function readIsDarkFromHtmlClass(): boolean {
  return document.documentElement.classList.contains("dark");
}

function useIsDarkFromHtmlClass(): boolean {
  return useSyncExternalStore(subscribeToHtmlDarkClass, readIsDarkFromHtmlClass, () => false);
}

function closestDimTrigger(el: EventTarget | null): Element | null {
  if (!(el instanceof Element)) return null;
  return el.closest(DIM_TRIGGER_SELECTOR);
}

function isFocusInsideDimArea(): boolean {
  const active = document.activeElement;
  if (!active || active === document.body) return false;
  return active.closest(DIM_TRIGGER_SELECTOR) != null;
}

const LiquidChromeLayer = memo(function LiquidChromeLayer({
  isDark,
  pageVisible,
  speed,
  interactive,
  prefersReducedMotion,
}: {
  isDark: boolean;
  pageVisible: boolean;
  speed: number;
  interactive: boolean;
  prefersReducedMotion: boolean;
}) {
  const baseColor = useMemo<[number, number, number]>(
    () => (isDark ? [0.03, 0.05, 0.07] : [0.5, 0.48, 0.46]),
    [isDark],
  );
  const amplitude = isDark ? 0.2 : 0.18;

  if (prefersReducedMotion) {
    const center = rgb01ToCss(baseColor);
    const edge = rgb01ToCss(
      isDark
        ? [baseColor[0] * 0.6, baseColor[1] * 0.6, baseColor[2] * 0.6]
        : [baseColor[0] * 1.08, baseColor[1] * 1.08, baseColor[2] * 1.08],
    );

    return (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: `radial-gradient(ellipse 120% 80% at 50% 40%, ${center} 0%, ${edge} 100%)`,
        }}
      />
    );
  }

  return (
    <LiquidChromeComponent
      amplitude={amplitude}
      baseColor={baseColor}
      interactive={interactive}
      paused={!pageVisible || prefersReducedMotion}
      speed={speed}
    />
  );
});

LiquidChromeLayer.displayName = "LiquidChromeLayer";

export default function AdaptiveLiquidChrome({
  speed = 0.012,
  dimOnHover = true,
  dimIntensity = 0.7, // 0.7 = reduce to 30% opacity when hovering
  dimIntensityFull = 0.6, // "full" dim → ~40% opacity when hovering data-dim-background="full"
  dimTransitionMs = 700, // quick to dim when you hover/focus
  to65TransitionMs = 1200, // quickish to 65% when no longer active (still slower than dim)
  to100TransitionMs = 2800, // slow the rest of the way to full, with ease
  onDimChange,
  cover = "viewport",
  interactive = true,
}: AdaptiveLiquidChromeProps) {
  const pageVisible = usePageVisible();
  const prefersReducedMotion = useReducedMotion() ?? false;
  const isDark = useIsDarkFromHtmlClass();
  const [brightnessState, setBrightnessState] = useState<BrightnessState>("rest");
  const [effectiveDimIntensity, setEffectiveDimIntensity] = useState(dimIntensity);
  const [transitionDuration, setTransitionDuration] = useState(`${to100TransitionMs}ms`);
  const phase2TimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onDimChangeRef = useRef(onDimChange);
  const hoverActiveRef = useRef(false);
  const focusActiveRef = useRef(false);
  const activityActiveRef = useRef(false);

  onDimChangeRef.current = onDimChange;

  const baseOpacity = isDark ? 1 : 0.92;

  useEffect(() => {
    if (!dimOnHover) return;

    const applyDimFromTrigger = (trigger: Element) => {
      if (phase2TimeoutRef.current) {
        clearTimeout(phase2TimeoutRef.current);
        phase2TimeoutRef.current = null;
      }
      setTransitionDuration(`${dimTransitionMs}ms`);
      const isFull = trigger.getAttribute("data-dim-background") === "full";

      setEffectiveDimIntensity(isFull ? dimIntensityFull : dimIntensity);
      setBrightnessState("dimmed");
      onDimChangeRef.current?.(true);
    };

    const tryRest = () => {
      if (hoverActiveRef.current || focusActiveRef.current || activityActiveRef.current) return;
      if (phase2TimeoutRef.current) {
        clearTimeout(phase2TimeoutRef.current);
        phase2TimeoutRef.current = null;
      }
      // Start brightening immediately: phase 1 dimmed → 65% (quickish)
      setTransitionDuration(`${to65TransitionMs}ms`);
      setBrightnessState("to65");
      onDimChangeRef.current?.(false);
      phase2TimeoutRef.current = setTimeout(() => {
        phase2TimeoutRef.current = null;
        // Phase 2: 65% → 100% (slow, ease)
        setTransitionDuration(`${to100TransitionMs}ms`);
        setBrightnessState("rest");
      }, to65TransitionMs);
    };

    const handlePointerOver = (e: PointerEvent) => {
      const trigger = closestDimTrigger(e.target);
      if (!trigger) return;

      hoverActiveRef.current = true;
      applyDimFromTrigger(trigger);
    };

    const handlePointerOut = (e: PointerEvent) => {
      const from = closestDimTrigger(e.target);
      if (!from) return;

      const related = e.relatedTarget;
      if (related instanceof Node && from.contains(related)) return;

      hoverActiveRef.current = false;
      if (!focusActiveRef.current && !activityActiveRef.current) tryRest();
    };

    const handleFocusIn = (e: FocusEvent) => {
      const dimEl = closestDimTrigger(e.target);
      if (!dimEl) return;

      focusActiveRef.current = true;
      applyDimFromTrigger(dimEl);
    };

    const handleFocusOut = () => {
      setTimeout(() => {
        focusActiveRef.current = isFocusInsideDimArea();
        if (!focusActiveRef.current && !hoverActiveRef.current && !activityActiveRef.current)
          tryRest();
      }, 0);
    };

    const syncActivitySignal = () => {
      const active = document.querySelector('[data-adaptive-active="true"]') != null;

      activityActiveRef.current = active;
      if (active) {
        if (phase2TimeoutRef.current) {
          clearTimeout(phase2TimeoutRef.current);
          phase2TimeoutRef.current = null;
        }
        setTransitionDuration(`${dimTransitionMs}ms`);
        setEffectiveDimIntensity(dimIntensityFull);
        setBrightnessState("dimmed");
        onDimChangeRef.current?.(true);
      } else if (!hoverActiveRef.current && !focusActiveRef.current) {
        tryRest();
      }
    };

    document.addEventListener("pointerover", handlePointerOver);
    document.addEventListener("pointerout", handlePointerOut);
    document.addEventListener("focusin", handleFocusIn);
    document.addEventListener("focusout", handleFocusOut);

    const observer = new MutationObserver(() => {
      syncActivitySignal();
    });

    syncActivitySignal();

    observer.observe(document.body, {
      attributes: true,
      attributeFilter: ["data-adaptive-active"],
      subtree: true,
    });

    return () => {
      document.removeEventListener("pointerover", handlePointerOver);
      document.removeEventListener("pointerout", handlePointerOut);
      document.removeEventListener("focusin", handleFocusIn);
      document.removeEventListener("focusout", handleFocusOut);
      observer.disconnect();
      if (phase2TimeoutRef.current) clearTimeout(phase2TimeoutRef.current);
    };
  }, [
    dimOnHover,
    dimIntensity,
    dimIntensityFull,
    dimTransitionMs,
    to65TransitionMs,
    to100TransitionMs,
  ]);

  const opacity =
    brightnessState === "dimmed"
      ? (1 - effectiveDimIntensity) * baseOpacity
      : brightnessState === "to65"
        ? BRIGHTEN_65 * baseOpacity
        : baseOpacity;

  const fillParent = cover === "parent";
  const viewportCover = !fillParent;
  const isAnimatingOpacity = brightnessState !== "rest";

  return (
    <div
      className="relative size-full"
      style={{
        width: "100%",
        height: fillParent ? "100%" : undefined,
        minHeight: fillParent ? "100%" : undefined,
        position: viewportCover ? "fixed" : "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: viewportCover ? 0 : undefined,
        opacity,
        transition: `opacity ${transitionDuration} ${EASE_SMOOTH}`,
        ...(isAnimatingOpacity ? { willChange: "opacity" as const } : {}),
      }}
    >
      <div aria-hidden className="liquid-chrome-fallback pointer-events-none absolute inset-0" />
      <div className="relative z-10 size-full">
        <LiquidChromeLayer
          interactive={interactive}
          isDark={isDark}
          pageVisible={pageVisible}
          prefersReducedMotion={prefersReducedMotion}
          speed={speed}
        />
      </div>
    </div>
  );
}
