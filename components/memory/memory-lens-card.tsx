"use client";

import { useCallback, useMemo } from "react";
import { MemoryItem } from "mem0ai/oss";
import { cn } from "@/lib/utils";
import { deleteMemory } from "@/lib/memory/operations";
import { createLogger } from "@/lib/logger";

const logger = createLogger("memory-lens-card");

export type MemoryLensCardProps = {
  memory: MemoryItem;
  onDeleted?: (id: string) => void;
  /** Compact for ephemeral / inline use; default false for lens grid */
  compact?: boolean;
};

export function MemoryLensCard({
  memory,
  onDeleted,
  compact = false,
}: MemoryLensCardProps) {
  const handleRemove = useCallback(async () => {
    try {
      const ok = await deleteMemory(memory.id);
      if (ok) onDeleted?.(memory.id);
      else logger.error("MemoryLensCard", "Delete failed");
    } catch (e) {
      logger.error("MemoryLensCard", "Delete error", e);
    }
  }, [memory.id, onDeleted]);

  const dateLabel = useMemo(() => {
    if (!memory.createdAt) return null;
    const d = new Date(memory.createdAt);
    return d.toLocaleDateString(undefined, {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  }, [memory.createdAt]);

  return (
    <article
      className={cn(
        "group rounded-2xl border border-white/10 dark:border-white/5",
        "bg-linear-to-br from-background-tertiary/40 to-background-tertiary/20",
        "dark:from-background-tertiary/30 dark:to-background-tertiary/10",
        "backdrop-blur-xl shadow-lg shadow-black/5 dark:shadow-black/20",
        "transition-all duration-200 hover:border-cyan-500/20 hover:shadow-cyan-500/5 hover:shadow-xl",
        compact ? "p-3" : "p-4"
      )}
    >
      <div className="flex gap-3">
        <div
          className={cn(
            "shrink-0 w-1 rounded-full bg-linear-to-b from-cyan-400/80 to-emerald-500/80",
            compact ? "min-h-8" : "min-h-10"
          )}
          aria-hidden
        />
        <div className="min-w-0 flex-1">
          <p
            className={cn(
              "text-foreground leading-relaxed",
              compact ? "text-sm" : "text-[15px]"
            )}
          >
            {memory.memory}
          </p>
          {dateLabel && (
            <p
              className={cn(
                "text-muted-foreground mt-1.5",
                compact ? "text-[11px]" : "text-xs"
              )}
            >
              {dateLabel}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={handleRemove}
          className={cn(
            "shrink-0 self-start rounded-lg px-2.5 py-1 text-xs font-medium",
            "text-muted-foreground hover:text-destructive hover:bg-destructive/10",
            "opacity-0 group-hover:opacity-100 transition-opacity"
          )}
          aria-label="Remove from memory"
        >
          Remove
        </button>
      </div>
    </article>
  );
}
