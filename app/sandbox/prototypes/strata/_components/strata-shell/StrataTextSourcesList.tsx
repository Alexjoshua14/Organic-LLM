"use client";

import { ChevronDown, ChevronUp, Trash2 } from "lucide-react";

import { glass } from "@/components/design-system/primitives";
import { cn } from "@/lib/utils";
import type { StrataTextSourceNode } from "@/lib/schemas/strata";

export function StrataTextSourcesList({
  sources,
  onRemove,
  onMove,
}: {
  sources: StrataTextSourceNode[];
  onRemove: (id: string) => void;
  onMove: (id: string, dir: -1 | 1) => void;
}) {
  if (sources.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-border/60 bg-muted/10 px-4 py-6 text-center text-sm text-muted-foreground">
        No structured sources yet. Add text, paste, import a file, search the web, or import a URL
        below.
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-2 pr-1">
      {sources.map((s, idx) => (
        <li
          key={s.id}
          className={cn(
            glass({ opaque: true }),
            "flex flex-col gap-2 rounded-lg border border-border/60 p-3 text-sm"
          )}
        >
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium text-foreground">{s.title}</p>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                {s.kind.replace("_", " ")}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <button
                type="button"
                className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-30"
                disabled={idx === 0}
                title="Move up"
                onClick={() => onMove(s.id, -1)}
              >
                <ChevronUp className="h-4 w-4" />
              </button>
              <button
                type="button"
                className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-30"
                disabled={idx === sources.length - 1}
                title="Move down"
                onClick={() => onMove(s.id, 1)}
              >
                <ChevronDown className="h-4 w-4" />
              </button>
              <button
                type="button"
                className="rounded-md p-1.5 text-destructive/80 hover:bg-destructive/10 hover:text-destructive"
                title="Remove source"
                onClick={() => onRemove(s.id)}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
          <p className="line-clamp-4 whitespace-pre-wrap text-[13px] leading-relaxed text-muted-foreground">
            {s.body}
          </p>
        </li>
      ))}
    </ul>
  );
}
