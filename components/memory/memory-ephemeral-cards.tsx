"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";

import { cn } from "@/lib/utils";

export type MemoryEphemeralCardsProps = {
  /** Memories just retrieved for this turn (shown as "Using memory") */
  retrieved?: { memory: string }[];
  /** Memories just added this turn (shown as "Added to memory") */
  added?: { memory: string }[];
  /** Clear after this many ms; 0 = never auto-clear */
  autoClearMs?: number;
  className?: string;
  /** When true, position absolute so cards overlay the conversation and don't affect layout. */
  overlay?: boolean;
  onOpenChange?: (opened: boolean) => void;
};

const CARD_ENTER_DURATION = 0.2;
const CARD_STAGGER_DELAY = 0.04;

function EphemeralCard({
  text,
  variant,
  index = 0,
}: {
  text: string;
  variant: "retrieved" | "added";
  index?: number;
}) {
  const isAdded = variant === "added";

  return (
    <motion.div
      animate={{ height: "auto", opacity: 1 }}
      className="overflow-hidden"
      initial={{ height: 0, opacity: 0 }}
      transition={{
        height: {
          duration: CARD_ENTER_DURATION,
          delay: index * CARD_STAGGER_DELAY,
        },
        opacity: {
          duration: CARD_ENTER_DURATION * 0.6,
          delay: index * CARD_STAGGER_DELAY,
        },
      }}
    >
      <div
        className={cn(
          "rounded-xl border backdrop-blur-sm px-3 py-2.5",
          isAdded
            ? "border-emerald-500/20 dark:border-emerald-400/15 bg-emerald-500/5 dark:bg-emerald-400/5"
            : "border-cyan-500/15 dark:border-cyan-400/10 bg-cyan-500/5 dark:bg-cyan-400/5"
        )}
      >
        <div className="flex gap-2">
          <div
            className={cn(
              "shrink-0 w-1 rounded-full",
              isAdded
                ? "bg-linear-to-b from-emerald-400/80 to-cyan-500/80"
                : "bg-linear-to-b from-cyan-400/80 to-cyan-600/60"
            )}
          />
          <p className="text-sm text-foreground leading-snug">{text}</p>
        </div>
      </div>
    </motion.div>
  );
}

/** Ephemeral cards shown in-chat when memory is retrieved or updated. */
export function MemoryEphemeralCards({
  retrieved = [],
  added = [],
  autoClearMs = 12_000,
  className,
  overlay = false,
  onOpenChange,
}: MemoryEphemeralCardsProps) {
  const [dismissed, setDismissed] = useState(false);
  const hasRetrieved = retrieved.length > 0;
  const hasAdded = added.length > 0;
  const show = !dismissed && (hasRetrieved || hasAdded);

  const hasContent = hasRetrieved || hasAdded;

  useEffect(() => {
    if (onOpenChange) {
      onOpenChange(show);
    }
  }, [show, onOpenChange]);

  useEffect(() => {
    if (!show || autoClearMs <= 0) return;
    const t = setTimeout(() => setDismissed(true), autoClearMs);

    return () => clearTimeout(t);
  }, [show, autoClearMs]);

  if (!hasContent) return null;

  if (dismissed) {
    return (
      <div
        className={cn(
          overlay && "absolute bottom-14 left-0 right-0 z-10 pointer-events-auto",
          className,
          "flex items-center justify-center py-1 min-h-0 h-auto!"
        )}
      >
        <button
          aria-label="View memory"
          className="text-2xs uppercase tracking-wider font-light hover:text-accent transition-colors cursor-pointer"
          type="button"
          onClick={() => setDismissed(false)}
        >
          Memory
        </button>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex flex-col gap-3 px-4 pb-2 animate-in fade-in slide-in-from-bottom-2 duration-300",
        overlay && "absolute bottom-14 left-0 right-0 z-10 pointer-events-auto",
        className
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <h2 className="m-0 text-2xs font-medium uppercase tracking-wider text-cyan-500/90 dark:text-cyan-400/90">
          Memory
        </h2>
        <button
          aria-label="Dismiss"
          className="text-2xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          type="button"
          onClick={() => setDismissed(true)}
        >
          Dismiss
        </button>
      </div>

      {hasRetrieved && (
        <section className="space-y-1.5">
          <p className="text-[11px] text-muted-foreground px-0.5">Used in this reply</p>
          <div className="flex flex-col gap-2">
            {retrieved.map((m, i) => (
              <EphemeralCard key={`r-${m.memory}`} index={i} text={m.memory} variant="retrieved" />
            ))}
          </div>
        </section>
      )}

      {hasAdded && (
        <section className="space-y-1.5">
          <p className="text-[11px] text-muted-foreground px-0.5">
            Just persisted — available in every thread
          </p>
          <div className="flex flex-col gap-2">
            {added.map((m, i) => (
              <EphemeralCard key={`a-${m.memory}`} index={i} text={m.memory} variant="added" />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
