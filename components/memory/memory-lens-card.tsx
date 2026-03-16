"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MemoryItem } from "mem0ai/oss";

import { cn } from "@/lib/utils";
import { deleteMemoryForCurrentUser } from "@/lib/memory/operations";
import { createLogger } from "@/lib/logger";

const logger = createLogger("memory-lens-card");

const EXIT_DURATION_MS = 280;
const PREVIEW_RESET_DELAY_MS = 2500;

export type MemoryLensCardProps = {
  memory: MemoryItem;
  onDeleted?: (id: string) => void;
  /** Compact for ephemeral / inline use; default false for lens grid */
  compact?: boolean;
  /** When true: animate out, keep in layout, no onDeleted; reset after delay so card reappears. */
  previewRemove?: boolean;
  /** When true, show relevance score (e.g. "85% match") when memory has a score. */
  showScore?: boolean;
};

export function MemoryLensCard({
  memory,
  onDeleted,
  compact = false,
  previewRemove = false,
  showScore = false,
}: MemoryLensCardProps) {
  const [isExiting, setIsExiting] = useState(false);
  const [containerHeight, setContainerHeight] = useState<number | null>(null);
  const [showDeletedState, setShowDeletedState] = useState(false);
  const exitDoneRef = useRef(false);
  const resetTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const articleRef = useRef<HTMLElement>(null);

  const resetForPreview = useCallback(() => {
    setContainerHeight(null);
    setShowDeletedState(false);
    setIsExiting(false);
    exitDoneRef.current = false;
  }, []);

  useEffect(() => {
    return () => {
      if (resetTimeoutRef.current) clearTimeout(resetTimeoutRef.current);
    };
  }, []);

  const handleRemove = useCallback(() => {
    if (isExiting) return;
    if (previewRemove && articleRef.current) {
      setContainerHeight(articleRef.current.offsetHeight);
    }
    setIsExiting(true);
  }, [isExiting, previewRemove]);

  const handleTransitionEnd = useCallback(
    (e: React.TransitionEvent<HTMLDivElement>) => {
      if (e.target !== e.currentTarget || !isExiting || exitDoneRef.current) return;
      if (e.propertyName !== "opacity") return;
      exitDoneRef.current = true;
      if (previewRemove) {
        setShowDeletedState(true);
        resetTimeoutRef.current = setTimeout(resetForPreview, PREVIEW_RESET_DELAY_MS);

        return;
      }
      (async () => {
        const result = await deleteMemoryForCurrentUser(memory.id);

        if (result.error) logger.error("MemoryLensCard", "Delete failed", result.error);
        else if (result.data === true) onDeleted?.(memory.id);
      })();
    },
    [isExiting, memory.id, onDeleted, previewRemove, resetForPreview]
  );

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

  const scoreLabel =
    showScore && typeof memory.score === "number" && Number.isFinite(memory.score)
      ? `${Math.round(memory.score * 100)}% match`
      : null;

  const useLayoutContainer = previewRemove && containerHeight !== null;

  return (
    <div
      aria-hidden={useLayoutContainer}
      className={cn("min-w-0", useLayoutContainer && "relative")}
      style={
        useLayoutContainer
          ? { minHeight: `${containerHeight}px`, transition: "min-height 0s" }
          : undefined
      }
    >
      {useLayoutContainer && (
        <div
          aria-hidden={!showDeletedState}
          aria-live="polite"
          className="absolute inset-0 flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-muted-foreground/25 bg-muted/30 dark:bg-muted/20 transition-opacity duration-150 ease-out pointer-events-none"
          role="status"
          style={{ opacity: showDeletedState ? 1 : 0 }}
        >
          <svg
            aria-hidden
            className="size-8 text-muted-foreground/70"
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            viewBox="0 0 24 24"
          >
            <path d="M20 6L9 17l-5-5" />
          </svg>
          <span className="text-xs font-medium text-muted-foreground">Deleted</span>
        </div>
      )}
      <article
        ref={articleRef}
        className={cn(
          "group rounded-2xl border backdrop-blur-xl shadow-lg shadow-black/5 dark:shadow-black/20",
          "transition-[box-shadow,border-color,background-color,border-color] duration-200 ease-out",
          compact ? "p-3" : "p-4",
          "overflow-hidden",
          !isExiting && "border-white/10 dark:border-white/5",
          !isExiting &&
            "bg-linear-to-br from-background-tertiary/40 to-background-tertiary/20 dark:from-background-tertiary/30 dark:to-background-tertiary/10",
          !isExiting && "hover:border-cyan-500/20 hover:shadow-cyan-500/5 hover:shadow-xl",
          isExiting && "border-transparent bg-transparent shadow-none"
        )}
        style={{
          transitionDuration: isExiting ? `${EXIT_DURATION_MS}ms` : undefined,
        }}
      >
        <div
          className="flex gap-3 origin-center ease-out"
          style={{
            transitionProperty: "opacity, transform",
            transitionDuration: `${EXIT_DURATION_MS}ms`,
            opacity: isExiting ? 0 : 1,
            transform: isExiting ? "scale(0.97)" : "scale(1)",
          }}
          onTransitionEnd={handleTransitionEnd}
        >
          <div
            aria-hidden
            className={cn(
              "shrink-0 w-1 rounded-full bg-linear-to-b from-cyan-400/80 to-emerald-500/80",
              compact ? "min-h-8" : "min-h-10"
            )}
          />
          <div className="min-w-0 flex-1">
            <p
              className={cn("text-foreground leading-relaxed", compact ? "text-sm" : "text-[15px]")}
            >
              {memory.memory}
            </p>
            {(dateLabel || scoreLabel) && (
              <div
                className={cn(
                  "text-muted-foreground mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-0.5",
                  compact ? "text-[11px]" : "text-xs"
                )}
              >
                {dateLabel && <span>{dateLabel}</span>}
                {scoreLabel && (
                  <span className="text-cyan-600 dark:text-cyan-400/90 font-medium">
                    {scoreLabel}
                  </span>
                )}
              </div>
            )}
          </div>
          <button
            aria-label="Remove from memory"
            className={cn(
              "shrink-0 self-start rounded-lg px-2.5 py-1 text-xs font-medium",
              "text-muted-foreground hover:text-destructive hover:bg-destructive/10",
              "opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity"
            )}
            type="button"
            onClick={handleRemove}
          >
            Remove
          </button>
        </div>
      </article>
    </div>
  );
}
