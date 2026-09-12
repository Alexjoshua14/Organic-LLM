"use client";

import { X } from "lucide-react";

import type { DiagramNodeLink } from "@/lib/mermaid/types";
import { cn } from "@/lib/utils";

type DiagramNodeChipProps = {
  link: DiagramNodeLink;
  onRemove: () => void;
};

/** Cursor-style reference pill — distinct from composer tool toggles. */
export function DiagramNodeChip({ link, onRemove }: DiagramNodeChipProps) {
  const shortLabel =
    link.label.length > 28 ? `${link.label.slice(0, 26).trimEnd()}…` : link.label;

  return (
    <span
      className={cn(
        "inline-flex max-w-full items-center gap-1 rounded-md px-2 py-0.5",
        "bg-accent/12 text-[11px] font-medium text-accent",
        "border border-accent/25"
      )}
    >
      <span className="truncate" title={link.label}>
        Diagram · {shortLabel}
      </span>
      <button
        aria-label={`Remove link to ${link.label}`}
        className="grid size-4 shrink-0 place-content-center rounded-sm text-accent/70 hover:bg-accent/15 hover:text-accent"
        type="button"
        onClick={onRemove}
      >
        <X className="size-3" />
      </button>
    </span>
  );
}
