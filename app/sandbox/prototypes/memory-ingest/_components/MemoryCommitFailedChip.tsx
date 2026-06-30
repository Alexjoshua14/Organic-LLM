"use client";

import type { CommitFailedMemory } from "../_lib/memory-ingest-filed";

import { AlertCircle } from "lucide-react";
import { useEffect } from "react";

import { cn } from "@/lib/utils";

/** How long the failure notice lingers before fading on its own. */
const COMMIT_FAILED_CHIP_TTL_MS = 10_000;

export type MemoryCommitFailedChipProps = {
  failed: CommitFailedMemory;
  onDismiss: () => void;
};

/**
 * Transient notice when commit_memory failed — nothing was stored.
 */
export function MemoryCommitFailedChip({ failed, onDismiss }: MemoryCommitFailedChipProps) {
  useEffect(() => {
    const t = setTimeout(onDismiss, COMMIT_FAILED_CHIP_TTL_MS);

    return () => clearTimeout(t);
  }, [onDismiss, failed.ts]);

  return (
    <div
      className={cn(
        "mx-auto mb-2 flex w-full max-w-[min(100%,360px)] items-start gap-2 rounded-xl px-3 py-2",
        "border border-destructive/30 bg-destructive/5 text-xs text-foreground shadow-sm backdrop-blur-sm"
      )}
      role="alert"
    >
      <AlertCircle aria-hidden className="mt-0.5 size-3.5 shrink-0 text-destructive/80" />
      <div className="min-w-0 flex-1">
        <p className="font-medium text-destructive/90">Write failed — not stored</p>
        <p className="mt-0.5 truncate text-muted-foreground">
          {failed.topic ? `${failed.topic} · ` : null}
          {failed.text}
        </p>
      </div>
    </div>
  );
}
