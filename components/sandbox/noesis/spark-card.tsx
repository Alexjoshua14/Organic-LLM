"use client";

import type { NoesisSpark } from "@/lib/sandbox/noesis/sparks/types";

import { Pencil } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * An authored Noesis spark rendered in the empty state. Tapping the body starts the
 * spark (production override); hovering reveals a bottom-right pencil to enter edit mode.
 */
export function SparkCard({
  spark,
  onTap,
  onEdit,
  disabled,
}: {
  spark: NoesisSpark;
  onTap: (spark: NoesisSpark) => void;
  onEdit: (spark: NoesisSpark) => void;
  disabled?: boolean;
}) {
  return (
    <div className="group relative">
      <button
        className={cn(
          "w-full rounded-lg border border-border/60 bg-background-secondary/40 px-3 py-3 pr-9 text-left text-sm",
          "hover:border-accent/40 hover:bg-background-secondary/70 transition-colors",
          "disabled:opacity-40 disabled:pointer-events-none"
        )}
        disabled={disabled}
        type="button"
        onClick={() => onTap(spark)}
      >
        {spark.userFacingText}
      </button>
      <button
        aria-label="Edit spark prompt"
        className={cn(
          "absolute bottom-2 right-2 rounded-md p-1 text-muted-foreground",
          "opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100",
          "hover:bg-background/60 hover:text-foreground"
        )}
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onEdit(spark);
        }}
      >
        <Pencil className="size-3.5" />
      </button>
    </div>
  );
}
