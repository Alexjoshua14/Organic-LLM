"use client";

import type { ErgonBoardBlock as ErgonBoardBlockData } from "@/lib/schemas/gen-ui";

import { useState } from "react";

import { ErgonBoardView } from "../ergon/ErgonBoardView";
import { Chip, DOT_COLOR, Dot, PriorityMark } from "../ergon/primitives";

import { CompositionBar } from "@/components/design-system/composition-bar";
import { cn } from "@/lib/utils";

type ErgonBoardProps = {
  block: ErgonBoardBlockData;
  partial?: boolean;
  /** Status distribution bar, then one row per lane: label, its top item, and "+N" for the rest. */
  condensed?: boolean;
};

function ErgonBoardCondensed({ block }: { block: ErgonBoardBlockData }) {
  const columns = block.columns.map((column) => ({
    ...column,
    items: block.items.filter((item) => item.stateType === column.id),
  }));
  const [laneFocus, setLaneFocus] = useState<string | null>(null);
  const filled = columns.filter((column) => column.items.length > 0);
  const empty = columns.filter((column) => column.items.length === 0);
  const distribution = columns
    .filter((column) => column.items.length > 0)
    .map((column) => `${column.items.length} ${column.label}`)
    .join(", ");

  return (
    <section className="mx-auto w-full max-w-sm space-y-stack-sm rounded-2xl bg-muted/30 p-inset-sm">
      <header className="flex items-center justify-between gap-inline-sm">
        <h3 className="min-w-0 truncate text-sm font-medium text-foreground">{block.title}</h3>
        <Chip>
          {block.items.length} {block.items.length === 1 ? "item" : "items"}
        </Chip>
      </header>

      {/* The app's one composition bar: status split; tapping a segment lights its lane row. */}
      {filled.length ? (
        <CompositionBar
          label={`Status distribution: ${distribution}`}
          selectedId={laneFocus}
          onSelectionChange={setLaneFocus}
          segments={filled.map((column) => ({
            id: column.id,
            value: column.items.length,
            color: DOT_COLOR[column.id],
            ariaLabel: `${column.label}: ${column.items.length}`,
          }))}
        />
      ) : (
        <p className="text-2xs text-muted-foreground">No work items</p>
      )}

      {/* One row per lane: five columns side by side truncate every label at phone width. */}
      <ul className="space-y-stack-xs">
        {filled.map((column) => {
          const [top, ...rest] = column.items;

          if (!top) return null;

          return (
            <li
              key={column.id}
              className={cn(
                "flex min-w-0 items-center gap-inline-sm rounded-lg px-inset-sm py-1.5",
                laneFocus === column.id ? "bg-muted" : "bg-muted/40"
              )}
            >
              <Dot type={column.id} />
              <span className="w-20 shrink-0 truncate text-2xs text-muted-foreground">
                {column.label}
              </span>
              <span className="flex min-w-0 flex-1 items-center gap-inline-xs">
                <PriorityMark p={top.priority} />
                <span className="min-w-0 truncate text-xs text-foreground">{top.title}</span>
              </span>
              <span className="shrink-0 font-mono text-2xs tabular-nums text-muted-foreground">
                {rest.length > 0 ? `+${rest.length}` : null}
                <span className="sr-only">
                  , {column.items.length} {column.items.length === 1 ? "item" : "items"}
                </span>
              </span>
            </li>
          );
        })}
      </ul>

      {empty.length ? (
        <p className="truncate text-2xs text-muted-foreground/70">
          Empty: {empty.map((column) => column.label).join(" · ")}
        </p>
      ) : null}

      {block.footnote ? <p className="text-2xs text-muted-foreground">{block.footnote}</p> : null}
    </section>
  );
}

export function ErgonBoard({ block, partial, condensed = false }: ErgonBoardProps) {
  if (condensed) return <ErgonBoardCondensed block={block} />;

  return <ErgonBoardView block={block} partial={partial} />;
}
