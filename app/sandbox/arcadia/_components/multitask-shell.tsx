"use client";

import { Layers3 } from "lucide-react";

import { useArcadiaMultitask } from "./multitask-provider";

import { glass } from "@/components/design-system/primitives";
import { cn } from "@/lib/utils";

/**
 * Shown when multitask view is **off** (normal Arcadia chat).
 * Toggles into the full multiagent dashboard for this thread — does not force on from runners.
 */
export function ArcadiaMultitaskShell() {
  const { toggleMultitaskView, toggleBlockedReason, agents } = useArcadiaMultitask();
  const working = agents.filter((a) => a.status === "working").length;

  return (
    <div
      className={cn(
        "fixed z-30 flex flex-col items-end gap-1",
        "top-[max(4.5rem,env(safe-area-inset-top,0px))] right-3 md:right-5"
      )}
    >
      <button
        className={cn(
          glass({ tone: "brown", opaque: true }),
          "flex items-center gap-2 rounded-full border border-border/60 px-3 py-2 text-xs font-medium shadow-lg",
          "hover:bg-background-secondary transition-colors"
        )}
        type="button"
        onClick={() => void toggleMultitaskView()}
      >
        <Layers3 aria-hidden className="size-3.5" />
        Multiagent
        {working > 0 ? (
          <span className="rounded-md bg-background/50 px-1.5 py-0.5 text-[10px] text-muted-foreground">
            {working} live
          </span>
        ) : null}
      </button>
      {toggleBlockedReason ? (
        <p className="max-w-[14rem] rounded-md bg-background/90 px-2 py-1 text-[10px] text-amber-800 shadow dark:text-amber-200">
          {toggleBlockedReason}
        </p>
      ) : null}
    </div>
  );
}
