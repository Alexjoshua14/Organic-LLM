"use client";

import type { SessionSignal } from "@/lib/sidebar/session-signal";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

import { sessionSignalStatusText } from "@/lib/sidebar/session-signal";
import { SESSION_TRAY_ENTER_S, SESSION_TRAY_EXIT_S } from "@/lib/sidebar/session-signal-timing";
import { cn } from "@/lib/utils";

const EASE = [0.25, 0.46, 0.45, 0.94] as const;

/**
 * The status line that opens under a row while its session is working, live, or paused, and
 * closes when it is not. It grows the row in place rather than moving it, so the list never
 * reorders under the user's eye. Text only: the glyph already carries the motion.
 */
export function SessionSignalTray({
  signal,
  className,
}: {
  signal: SessionSignal;
  className?: string;
}) {
  const reduceMotion = useReducedMotion();
  const text = sessionSignalStatusText(signal);

  return (
    <AnimatePresence initial={false}>
      {text ? (
        <motion.div
          key="tray"
          animate={{
            height: "auto",
            opacity: 1,
            transition: { duration: reduceMotion ? 0 : SESSION_TRAY_ENTER_S, ease: EASE },
          }}
          className={cn("overflow-hidden", className)}
          exit={{
            height: 0,
            opacity: 0,
            transition: { duration: reduceMotion ? 0 : SESSION_TRAY_EXIT_S, ease: EASE },
          }}
          initial={{ height: 0, opacity: 0 }}
        >
          <p
            className={cn(
              "truncate pb-0.5 text-2xs leading-tight tracking-wide",
              signal.kind === "paused" && "text-muted-foreground/70",
              signal.kind === "notice" && "text-foreground-secondary",
              signal.kind !== "paused" && signal.kind !== "notice" && "text-muted-foreground"
            )}
          >
            {text}
          </p>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
