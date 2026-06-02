"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export interface GlassOverlayProps extends React.ComponentProps<"div"> {
  /**
   * Glass overlay component for indicating active state.
   * Positioned absolutely over target elements with backdrop blur and semi-transparent background.
   */
}

/**
 * Glass Overlay
 * 
 * A reusable glass overlay component positioned over active elements to indicate selection.
 * Uses backdrop blur and semi-transparent background matching Nebulae's glass aesthetic.
 * 
 * Usage:
 * ```tsx
 * <div className="relative">
 *   <Button variant="inset">Active</Button>
 *   <GlassOverlay />
 * </div>
 * ```
 */
export function GlassOverlay({
  className,
  children,
  ...props
}: GlassOverlayProps) {
  return (
    <div
      className={cn(
        "absolute inset-0 rounded-md",
        "backdrop-blur-[0.5px] bg-white/3 dark:bg-white/10",
        "border border-white/15 dark:border-white/15",
        "pointer-events-none",
        "scale-[1.5] backdrop-brightness-200 backdrop-saturate-200 origin-center",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

