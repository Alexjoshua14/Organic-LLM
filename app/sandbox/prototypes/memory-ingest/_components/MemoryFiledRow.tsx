"use client";

import type { FiledMemory } from "../_lib/memory-ingest-filed";

import { Check, Undo2 } from "lucide-react";
import { useState } from "react";

import { formatFiledAt } from "../_lib/memory-ingest-filed";

import { cn } from "@/lib/utils";

export type MemoryFiledRowProps = {
  filed: FiledMemory;
  expanded: boolean;
  onToggleExpand: () => void;
  /** When provided and `filed.id` exists, shows Undo. */
  onForget?: (id: string) => Promise<boolean>;
  variant?: "chip" | "list";
  showUndo?: boolean;
  className?: string;
};

/**
 * Expandable row for a filed memory — shared by the transient chip and the session tray list.
 */
export function MemoryFiledRow({
  filed,
  expanded,
  onToggleExpand,
  onForget,
  variant = "chip",
  showUndo = true,
  className,
}: MemoryFiledRowProps) {
  const [forgetting, setForgetting] = useState(false);

  const handleUndo = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!filed.id || !onForget) return;
    setForgetting(true);
    await onForget(filed.id);
    setForgetting(false);
  };

  const canUndo = showUndo && Boolean(filed.id && onForget);

  return (
    <div
      className={cn(
        "flex w-full gap-2 rounded-xl border border-border bg-card/80 text-xs text-foreground shadow-sm backdrop-blur-sm",
        variant === "chip" ? "px-3 py-2" : "px-2.5 py-2",
        className
      )}
    >
      <Check aria-hidden className="mt-0.5 size-3.5 shrink-0 text-foreground/70" />
      <button
        aria-expanded={expanded}
        className={cn(
          "min-w-0 flex-1 cursor-pointer text-left focus-visible:outline-none focus-visible:ring-1",
          "focus-visible:ring-ring rounded-sm"
        )}
        type="button"
        onClick={onToggleExpand}
      >
        {expanded ? (
          <div className="space-y-1.5">
            <p className="text-sm leading-snug text-foreground whitespace-pre-wrap">{filed.text}</p>
            {filed.topic ? (
              <p className="text-muted-foreground">
                <span className="font-medium text-foreground/80">Topic</span> · {filed.topic}
              </p>
            ) : null}
            <p className="text-muted-foreground">
              <span className="font-medium text-foreground/80">Filed</span> · {formatFiledAt(filed.ts)}
            </p>
            <p className="text-muted-foreground/90">Persisted — available in every thread</p>
          </div>
        ) : (
          <span className="block min-w-0 truncate">
            <span className="text-muted-foreground">Filed</span>
            {filed.topic ? <span className="text-muted-foreground"> · {filed.topic}</span> : null}
            <span className="text-muted-foreground"> · </span>
            <span className="text-foreground">{filed.text}</span>
          </span>
        )}
      </button>
      {canUndo ? (
        <button
          className={cn(
            "inline-flex shrink-0 self-start items-center gap-1 rounded-md px-1.5 py-0.5 text-muted-foreground",
            "transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-1",
            "focus-visible:ring-ring disabled:opacity-50"
          )}
          disabled={forgetting}
          type="button"
          onClick={handleUndo}
        >
          <Undo2 aria-hidden className="size-3" />
          {forgetting ? "Removing…" : "Undo"}
        </button>
      ) : null}
    </div>
  );
}
