"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

export type MemoryEphemeralCardsProps = {
  /** Memories just retrieved for this turn (shown as "Using memory") */
  retrieved?: { memory: string }[];
  /** Memories just added this turn (shown as "Added to memory") */
  added?: { memory: string }[];
  /** Clear after this many ms; 0 = never auto-clear */
  autoClearMs?: number;
  className?: string;
};

function EphemeralCard({
  text,
  variant,
}: {
  text: string;
  variant: "retrieved" | "added";
}) {
  const isAdded = variant === "added";
  return (
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
  );
}

/** Ephemeral cards shown in-chat when memory is retrieved or updated. */
export function MemoryEphemeralCards({
  retrieved = [],
  added = [],
  autoClearMs = 12_000,
  className,
}: MemoryEphemeralCardsProps) {
  const [dismissed, setDismissed] = useState(false);
  const hasRetrieved = retrieved.length > 0;
  const hasAdded = added.length > 0;
  const show = !dismissed && (hasRetrieved || hasAdded);

  useEffect(() => {
    if (!show || autoClearMs <= 0) return;
    const t = setTimeout(() => setDismissed(true), autoClearMs);
    return () => clearTimeout(t);
  }, [show, autoClearMs]);

  if (!show) return null;

  return (
    <div
      className={cn(
        "flex flex-col gap-3 px-4 pb-2 animate-in fade-in slide-in-from-bottom-2 duration-300",
        className
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-medium uppercase tracking-wider text-cyan-500/90 dark:text-cyan-400/90">
          Memory
        </span>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="text-[11px] text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Dismiss"
        >
          Dismiss
        </button>
      </div>

      {hasRetrieved && (
        <section className="space-y-1.5">
          <p className="text-[11px] text-muted-foreground px-0.5">
            Used in this reply
          </p>
          <div className="flex flex-col gap-2">
            {retrieved.map((m, i) => (
              <EphemeralCard key={`r-${i}`} text={m.memory} variant="retrieved" />
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
              <EphemeralCard key={`a-${i}`} text={m.memory} variant="added" />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
