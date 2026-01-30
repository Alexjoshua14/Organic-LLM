"use client";

import { useTheme } from "next-themes";
import { useEffect, useState, useRef } from "react";
import { LiquidChrome as LiquidChromeComponent } from "@/components/third-party/reactbits/LiquidChrome/LiquidChrome";

interface AdaptiveLiquidChromeProps {
  speed?: number;
  dimOnHover?: boolean;
  dimIntensity?: number; // 0-1, how much to dim (0 = no dim, 1 = fully dimmed)
  restDelay?: number; // milliseconds to wait before returning to rest state
}

/**
 * AdaptiveLiquidChrome - A smart background that automatically dims when hovering
 * over important UI elements, with intentional delay before returning to rest.
 * 
 * The delay creates a sense of the system being "ready" and "waiting" - like it's
 * holding its breath before returning to its ambient state.
 * 
 * Usage: Add `data-dim-background` attribute to any element that should trigger dimming.
 * Example: <Button data-dim-background>Click me</Button>
 */
export default function AdaptiveLiquidChrome({ 
  speed = 0.03,
  dimOnHover = true,
  dimIntensity = 0.7, // 0.7 = reduce to 30% opacity when hovering
  restDelay = 2800, // ~3 seconds delay before returning - feels thoughtful and intentional
}: AdaptiveLiquidChromeProps) {
  const { resolvedTheme } = useTheme();
  const [isDimmed, setIsDimmed] = useState(false);
  const restTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const isDark = resolvedTheme === "dark";

  const baseColor: [number, number, number] =
    isDark ? [0.03, 0.05, 0.07] : [0.28, 0.33, 0.38];

  // Light mode can feel visually "loud" against white UI—soften it slightly.
  const baseOpacity = isDark ? 1 : 0.72;
  const amplitude = isDark ? 0.2 : 0.14;

  useEffect(() => {
    if (!dimOnHover) return;

    // Track all elements that should trigger background dimming
    const handleMouseEnter = () => {
      // Clear any pending return-to-rest
      if (restTimeoutRef.current) {
        clearTimeout(restTimeoutRef.current);
        restTimeoutRef.current = null;
      }
      setIsDimmed(true);
    };
    
    const handleMouseLeave = () => {
      // Don't immediately return - wait with intentional delay
      // This creates the feeling of "ready and waiting" before resuming ambient state
      restTimeoutRef.current = setTimeout(() => {
        setIsDimmed(false);
        restTimeoutRef.current = null;
      }, restDelay);
    };

    // Use MutationObserver to handle dynamically added elements
    const observer = new MutationObserver(() => {
      const elements = document.querySelectorAll('[data-dim-background]');
      elements.forEach((element) => {
        element.addEventListener('mouseenter', handleMouseEnter);
        element.addEventListener('mouseleave', handleMouseLeave);
      });
    });

    // Initial setup
    const elements = document.querySelectorAll('[data-dim-background]');
    elements.forEach((element) => {
      element.addEventListener('mouseenter', handleMouseEnter);
      element.addEventListener('mouseleave', handleMouseLeave);
    });

    // Observe the entire document for new elements
    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    return () => {
      observer.disconnect();
      const elements = document.querySelectorAll('[data-dim-background]');
      elements.forEach((element) => {
        element.removeEventListener('mouseenter', handleMouseEnter);
        element.removeEventListener('mouseleave', handleMouseLeave);
      });
      // Clear any pending timeouts
      if (restTimeoutRef.current) {
        clearTimeout(restTimeoutRef.current);
      }
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
