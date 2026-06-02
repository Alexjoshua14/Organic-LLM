"use client";

import * as React from "react";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";

interface GlassSurfacePrototypeProps extends React.ComponentProps<"div"> {
  blur?: number; // backdrop-blur value (0-100)
  backgroundOpacity?: number; // 0-100
  border?: boolean;
  borderOpacity?: number; // 0-100
  shadowIntensity?: number; // 0-100
  borderRadius?: string; // Tailwind radius class (e.g., "xl", "2xl", "3xl")
  interactive?: boolean;
}

export function GlassSurfacePrototype({
  blur = 24,
  backgroundOpacity = 40,
  border = true,
  borderOpacity = 20,
  shadowIntensity = 50,
  borderRadius = "2xl",
  interactive = true,
  className,
  children,
  style,
  ...props
}: GlassSurfacePrototypeProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);

  // Detect dark mode
  useEffect(() => {
    const checkDarkMode = () => {
      setIsDarkMode(document.documentElement.classList.contains("dark"));
    };
    checkDarkMode();
    const observer = new MutationObserver(checkDarkMode);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });
    return () => observer.disconnect();
  }, []);

  // Map border radius to Tailwind classes - ensure all control options are valid
  const radiusClassMap: Record<string, string> = {
    none: "rounded-none",
    sm: "rounded-sm",
    md: "rounded-md",
    lg: "rounded-lg",
    "2xl": "rounded-2xl",
  };
  const radiusClass = radiusClassMap[borderRadius] || "rounded-2xl";

  // Calculate background opacity (0-100 to 0-1)
  const bgOpacity = backgroundOpacity / 100;
  const bgDarkOpacity = bgOpacity * 0.125; // Dark mode is typically 5% of light mode

  // Calculate border opacity
  const borderOpacityValue = borderOpacity / 100;

  // Calculate shadow intensity (0-100 to opacity multiplier)
  const shadowOpacity = shadowIntensity / 100;

  const hoverClasses = interactive && isHovered ? "scale-[1.02]" : "";

  const hoverStyle = interactive
    ? {
      transform: isHovered ? "translateY(-4px)" : "translateY(0)",
    }
    : undefined;

  // Build inline styles - use dark mode values if dark mode is active
  const inlineStyle: React.CSSProperties = {
    ...style,
    backgroundColor: isDarkMode
      ? `rgba(255, 255, 255, ${bgDarkOpacity})`
      : `rgba(255, 255, 255, ${bgOpacity})`,
    borderColor: border ? `rgba(255, 255, 255, ${borderOpacityValue})` : "transparent",
    boxShadow: isHovered && interactive
      ? isDarkMode
        ? `0 20px 25px -5px rgba(0, 0, 0, ${0.4 * shadowOpacity}), 0 10px 10px -5px rgba(0, 0, 0, ${0.16 * shadowOpacity})`
        : `0 20px 25px -5px rgba(0, 0, 0, ${0.1 * shadowOpacity}), 0 10px 10px -5px rgba(0, 0, 0, ${0.04 * shadowOpacity})`
      : isDarkMode
        ? `0 10px 15px -3px rgba(0, 0, 0, ${0.2 * shadowOpacity}), 0 4px 6px -2px rgba(0, 0, 0, ${0.4 * shadowOpacity})`
        : `0 10px 15px -3px rgba(0, 0, 0, ${0.05 * shadowOpacity}), 0 4px 6px -2px rgba(0, 0, 0, ${0.1 * shadowOpacity})`,
    ...hoverStyle,
  };

  return (
    <div
      data-slot="glass-surface"
      onMouseEnter={interactive ? () => setIsHovered(true) : undefined}
      onMouseLeave={interactive ? () => setIsHovered(false) : undefined}
      className={cn(
        "relative overflow-hidden flex flex-col gap-6 transition-all duration-350 ease-out p-8",
        radiusClass,
        border && "border",
        interactive && "cursor-pointer",
        hoverClasses,
        className
      )}
      style={{
        ...inlineStyle,
        backdropFilter: blur > 0 ? `blur(${blur}px)` : "none",
      }}
      {...props}
    >
      {/* Subtle glow on hover for interactive variant */}
      {interactive && (
        <div
          className={cn(
            "absolute inset-0 bg-linear-to-br from-white/20 via-transparent to-transparent dark:from-white/5 transition-opacity duration-350 pointer-events-none",
            isHovered ? "opacity-100" : "opacity-0"
          )}
        />
      )}

      {/* Content */}
      <div className="relative z-10">{children}</div>
    </div>
  );
}

