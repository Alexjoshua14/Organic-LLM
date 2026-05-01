"use client";

import type { StrataTextSourceNode } from "@/lib/schemas/strata";

import { ChevronDown, ChevronUp, Pencil, Trash2 } from "lucide-react";

import { glass } from "@/components/design-system/primitives";
import { Badge } from "@/components/third-party/ui/badge";
import { cn } from "@/lib/utils";
import {
  getStrataTextSourceSynopsis,
  getStrataTextSourceTypeLabel,
} from "@/lib/strata/text-sources";

export function StrataTextSourceCard({
  source,
  index,
  total,
  active,
  onOpen,
  onMove,
  onRemove,
  onEdit,
}: {
  source: StrataTextSourceNode;
  index: number;
  total: number;
  /** When true the card is the currently-active notepad note. */
  active?: boolean;
  onOpen: () => void;
  onMove: (id: string, dir: -1 | 1) => void;
  onRemove: (id: string) => void;
  onEdit: (id: string) => void;
}) {
  const synopsis = getStrataTextSourceSynopsis(source);
  const typeLabel = getStrataTextSourceTypeLabel(source.kind);
  const atFirst = index <= 0;
  const atLast = index >= total - 1;

  return (
    <div
      role="button"
      tabIndex={0}
      aria-current={active ? "true" : undefined}
      className={cn(
        glass({ opaque: true }),
        "flex w-full cursor-pointer flex-col gap-2 rounded-xl border border-border/60 p-3 text-left transition-colors hover:border-border",
        active && "border-primary/60 ring-1 ring-primary/30"
      )}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen();
        }
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
          {source.title}
        </h3>
        <div className="flex shrink-0 items-center gap-1">
          {active ? (
            <Badge className="shrink-0 bg-primary/10 text-primary" variant="outline">
              Editing
            </Badge>
          ) : null}
          <Badge className="shrink-0" variant="outline">
            {typeLabel}
          </Badge>
        </div>
      </div>
      {synopsis ? (
        <p className="line-clamp-2 min-h-10 text-sm leading-snug text-muted-foreground">
          {synopsis}
        </p>
      ) : (
        <p className="line-clamp-2 min-h-10 text-sm italic text-muted-foreground/80">No preview</p>
      )}

      <div
        className="flex items-center justify-end gap-0.5 border-t border-border/50 pt-2"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-30"
          disabled={atFirst}
          title="Move up"
          aria-label="Move up"
          onClick={() => onMove(source.id, -1)}
        >
          <ChevronUp className="h-4 w-4" />
        </button>
        <button
          type="button"
          className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-30"
          disabled={atLast}
          title="Move down"
          aria-label="Move down"
          onClick={() => onMove(source.id, 1)}
        >
          <ChevronDown className="h-4 w-4" />
        </button>
        <button
          type="button"
          className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
          title="Edit"
          aria-label="Edit source"
          onClick={() => onEdit(source.id)}
        >
          <Pencil className="h-4 w-4" />
        </button>
        <button
          type="button"
          className="rounded-md p-1.5 text-destructive/80 hover:bg-destructive/10 hover:text-destructive"
          title="Remove"
          aria-label="Remove source"
          onClick={() => onRemove(source.id)}
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
