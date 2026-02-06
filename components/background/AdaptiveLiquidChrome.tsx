"use client";

import { useTheme } from "next-themes";
import { useEffect, useState, useRef } from "react";
import { LiquidChrome as LiquidChromeComponent } from "@/components/third-party/reactbits/LiquidChrome/LiquidChrome";

interface AdaptiveLiquidChromeProps {
  speed?: number;
  dimOnHover?: boolean;
  dimIntensity?: number; // 0-1, how much to dim (0 = no dim, 1 = fully dimmed)
  restDelay?: number; // milliseconds to wait before returning to rest state
  /** Called when dimmed state changes (e.g. for realtime display / debugging). */
  onDimChange?: (dimmed: boolean) => void;
}

/**
 * AdaptiveLiquidChrome - A smart background that dims when hovering or when focus
 * is inside important UI elements (e.g. typing in an input), with intentional delay
 * before returning to rest once both hover and focus are gone.
 *
 * Usage: Add `data-dim-background` to any element that should trigger dimming.
 * Example: <Button data-dim-background>Click me</Button>
 * Focusable descendants (e.g. <Input>) keep the background dimmed while active.
 */
export default function AdaptiveLiquidChrome({
  speed = 0.03,
  dimOnHover = true,
  dimIntensity = 0.7, // 0.7 = reduce to 30% opacity when hovering
  restDelay = 2800, // ~3 seconds delay before returning - feels thoughtful and intentional
  onDimChange,
}: AdaptiveLiquidChromeProps) {
  const { resolvedTheme } = useTheme();
  const [isDimmed, setIsDimmed] = useState(false);
  const restTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const onDimChangeRef = useRef(onDimChange);
  const hoverActiveRef = useRef(false);
  const focusActiveRef = useRef(false);
  onDimChangeRef.current = onDimChange;

  const isFocusInsideDimArea = () =>
    Array.from(document.querySelectorAll("[data-dim-background]")).some(
      (el: Element) => el.contains(document.activeElement),
    );

  const isDark = resolvedTheme === "dark";

  // Dark: deep blue-gray. Light: warmer, richer gray (matches app’s warm neutrals) so it doesn’t feel faded.
  const baseColor: [number, number, number] = isDark
    ? [0.03, 0.05, 0.07]
    : [0.34, 0.32, 0.3]; // RGB 0–1: warm gray

  const baseOpacity = isDark ? 1 : 0.92;
  const amplitude = isDark ? 0.2 : 0.18;

  useEffect(() => {
    if (!dimOnHover) return;

    const tryRest = () => {
      if (hoverActiveRef.current || focusActiveRef.current) return;
      restTimeoutRef.current = setTimeout(() => {
        restTimeoutRef.current = null;
        setIsDimmed(false);
        onDimChangeRef.current?.(false);
      }, restDelay);
    };

    const handleMouseEnter = () => {
      if (restTimeoutRef.current) {
        clearTimeout(restTimeoutRef.current);
        restTimeoutRef.current = null;
      }
      hoverActiveRef.current = true;
      setIsDimmed(true);
      onDimChangeRef.current?.(true);
    };

    const handleMouseLeave = () => {
      hoverActiveRef.current = false;
      if (!focusActiveRef.current) tryRest();
    };

    const handleFocusIn = (e: FocusEvent) => {
      const target = e.target as Node;
      const inDimArea = Array.from(document.querySelectorAll("[data-dim-background]")).some(
        (el: Element) => el.contains(target),
      );
      if (!inDimArea) return;
      if (restTimeoutRef.current) {
        clearTimeout(restTimeoutRef.current);
        restTimeoutRef.current = null;
      }
      focusActiveRef.current = true;
      setIsDimmed(true);
      onDimChangeRef.current?.(true);
    };

    const handleFocusOut = () => {
      setTimeout(() => {
        focusActiveRef.current = isFocusInsideDimArea();
        if (!focusActiveRef.current && !hoverActiveRef.current) tryRest();
      }, 0);
    };

    document.addEventListener("focusin", handleFocusIn);
    document.addEventListener("focusout", handleFocusOut);

    const observer = new MutationObserver(() => {
      const elements = document.querySelectorAll("[data-dim-background]");
      elements.forEach((el) => {
        el.addEventListener("mouseenter", handleMouseEnter);
        el.addEventListener("mouseleave", handleMouseLeave);
      });
    });

    const elements = document.querySelectorAll("[data-dim-background]");
    elements.forEach((el) => {
      el.addEventListener("mouseenter", handleMouseEnter);
      el.addEventListener("mouseleave", handleMouseLeave);
    });

    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      document.removeEventListener("focusin", handleFocusIn);
      document.removeEventListener("focusout", handleFocusOut);
      observer.disconnect();
      document.querySelectorAll("[data-dim-background]").forEach((el) => {
        el.removeEventListener("mouseenter", handleMouseEnter);
        el.removeEventListener("mouseleave", handleMouseLeave);
      });
      if (restTimeoutRef.current) clearTimeout(restTimeoutRef.current);
    };
  }, [dimOnHover, restDelay]);

  return (
    <div
      style={{
        width: "100dvw",
        height: "100dvh",
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        opacity: (isDimmed ? 1 - dimIntensity : 1) * baseOpacity,
        transition: "opacity 2.5s cubic-bezier(0.25, 0.46, 0.45, 0.94)",
        willChange: "opacity",
      }}
    >
      <LiquidChromeComponent
        amplitude={amplitude}
        baseColor={baseColor}
        interactive={true}
        speed={speed}
      />
    </div>
  );
}
