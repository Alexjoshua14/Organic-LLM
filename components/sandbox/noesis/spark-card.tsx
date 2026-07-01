"use client";

import type { NoesisSpark } from "@/lib/sandbox/noesis/sparks/types";

import { useRef } from "react";
import { Pencil } from "lucide-react";

import { cn } from "@/lib/utils";

/** Hold duration (ms) before a touch long-press opens the editor. */
const LONG_PRESS_MS = 450;

/**
 * An authored Noesis spark in the empty state. Tap the body to start the spark
 * (production override). To edit the prompt: **hover → pencil** on desktop, or
 * **long-press** the card on touch devices (no hover there).
 */
export function SparkCard({
  spark,
  onTap,
  onEdit,
  disabled,
}: {
  spark: NoesisSpark;
  onTap: (spark: NoesisSpark) => void;
  onEdit: (spark: NoesisSpark) => void;
  disabled?: boolean;
}) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressFiredRef = useRef(false);

  const clearTimer = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const startPress = () => {
    if (disabled) return;
    longPressFiredRef.current = false;
    clearTimer();
    timerRef.current = setTimeout(() => {
      longPressFiredRef.current = true; // consumed by the follow-up click so tap doesn't also fire
      onEdit(spark);
    }, LONG_PRESS_MS);
  };

  const handleClick = () => {
    // A long-press already opened the editor; swallow the trailing click.
    if (longPressFiredRef.current) {
      longPressFiredRef.current = false;

      return;
    }
    onTap(spark);
  };

  return (
    <div className="group relative">
      <button
        className={cn(
          "w-full select-none rounded-lg border border-border/60 bg-background-secondary/40 px-3 py-3 pr-9 text-left text-sm",
          "hover:border-accent/40 hover:bg-background-secondary/70 transition-colors",
          "disabled:opacity-40 disabled:pointer-events-none"
        )}
        disabled={disabled}
        style={{ WebkitTouchCallout: "none" }}
        type="button"
        onClick={handleClick}
        onContextMenu={(e) => e.preventDefault()}
        onTouchCancel={clearTimer}
        onTouchEnd={clearTimer}
        onTouchMove={clearTimer}
        onTouchStart={startPress}
      >
        {spark.userFacingText}
      </button>
      <button
        aria-label="Edit spark prompt"
        className={cn(
          "absolute bottom-2 right-2 rounded-md p-1 text-muted-foreground transition-opacity",
          // Desktop affordance: hidden until hover/focus. On touch, long-press the card instead.
          "opacity-0 focus-visible:opacity-100 group-hover:opacity-100",
          "hover:bg-background/60 hover:text-foreground"
        )}
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onEdit(spark);
        }}
      >
        <Pencil className="size-3.5" />
      </button>
    </div>
  );
}
