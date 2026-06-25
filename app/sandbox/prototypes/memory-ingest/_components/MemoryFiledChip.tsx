"use client";

import type { FiledMemory } from "../_lib/memory-ingest-filed";

import { Check, Undo2 } from "lucide-react";
import { useEffect, useState } from "react";

import { cn } from "@/lib/utils";

/** How long the receipt lingers before fading on its own. */
const FILED_CHIP_TTL_MS = 8000;

export type MemoryFiledChipProps = {
  filed: FiledMemory;
  onDismiss: () => void;
  /** Removes the memory; resolves true on success. Mounted only when `filed.id` exists. */
  onForget: (id: string) => Promise<boolean>;
};

/**
 * Transient "Filed … / Undo" receipt for a real commit_memory write. Complements Delphi's
 * conversational "Filed." with a glanceable, reversible record of what was actually stored.
 */
export function MemoryFiledChip({ filed, onDismiss, onForget }: MemoryFiledChipProps) {
  const [forgetting, setForgetting] = useState(false);

  // Auto-dismiss once settled; pause the countdown while an Undo is in flight.
  useEffect(() => {
    if (forgetting) return;
    const t = setTimeout(onDismiss, FILED_CHIP_TTL_MS);

    return () => clearTimeout(t);
  }, [forgetting, onDismiss]);

  const handleUndo = async () => {
    if (!filed.id) return;
    setForgetting(true);
    const ok = await onForget(filed.id);

    if (ok) {
      onDismiss();
    } else {
      setForgetting(false);
    }
  };

  return (
    <div
      className={cn(
        "mx-auto mb-2 flex w-full max-w-[min(100%,360px)] items-center gap-2 rounded-xl px-3 py-2",
        "border border-border bg-card/80 text-xs text-foreground shadow-sm backdrop-blur-sm"
      )}
      role="status"
    >
      <Check aria-hidden className="size-3.5 shrink-0 text-foreground/70" />
      <span className="min-w-0 flex-1 truncate">
        <span className="text-muted-foreground">Filed</span>
        {filed.topic ? <span className="text-muted-foreground"> · {filed.topic}</span> : null}
        <span className="text-muted-foreground"> · </span>
        <span className="text-foreground">{filed.text}</span>
      </span>
      {filed.id ? (
        <button
          className={cn(
            "inline-flex shrink-0 items-center gap-1 rounded-md px-1.5 py-0.5 text-muted-foreground",
            "transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-1",
            "focus-visible:ring-ring disabled:opacity-50"
          )}
          disabled={forgetting}
          onClick={handleUndo}
          type="button"
        >
          <Undo2 aria-hidden className="size-3" />
          {forgetting ? "Removing…" : "Undo"}
        </button>
      ) : null}
    </div>
  );
}
