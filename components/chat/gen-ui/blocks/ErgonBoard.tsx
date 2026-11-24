"use client";

import type { ErgonBoardBlock as ErgonBoardBlockData } from "@/lib/schemas/gen-ui";

import { ErgonBoardView } from "../ergon/ErgonBoardView";
import { Chip, DOT, Dot, PriorityMark } from "../ergon/primitives";

import { cn } from "@/lib/utils";

type ErgonBoardProps = {
  block: ErgonBoardBlockData;
  partial?: boolean;
  /** Mini kanban: status columns side by side with counts, a top card and stacked slivers. */
  condensed?: boolean;
};

/** Literal class names so Tailwind generates them; the schema allows one to five columns. */
const GRID_COLS = [
  "grid-cols-1",
  "grid-cols-1",
  "grid-cols-2",
  "grid-cols-3",
  "grid-cols-4",
  "grid-cols-5",
] as const;

/** Cards drawn as slivers under the top card before the rest collapse into "+N". */
const MAX_SLIVERS = 3;

function ErgonBoardCondensed({ block }: { block: ErgonBoardBlockData }) {
  const columns = block.columns.map((column) => ({
    ...column,
    items: block.items.filter((item) => item.stateType === column.id),
  }));
  const ordered = columns.flatMap((column) => column.items);
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

      {/* One equal segment per item, so the bar is the status distribution without inline sizes. */}
      <div
        role="img"
        aria-label={distribution ? `Status distribution: ${distribution}` : "No work items"}
        className="flex h-1.5 overflow-hidden rounded-full bg-muted/40"
      >
        {ordered.map((item) => (
          <span key={`${item.source}:${item.id}`} className={cn("flex-1", DOT[item.stateType])} />
        ))}
      </div>

      <ul className={cn("grid gap-inline-xs", GRID_COLS[block.columns.length])}>
        {columns.map((column) => {
          const [top, ...rest] = column.items;
          const slivers = rest.slice(0, MAX_SLIVERS);
          const more = rest.length - slivers.length;

          return (
            <li
              key={column.id}
              className="min-w-0 space-y-stack-xs rounded-xl bg-muted/40 p-inset-sm"
              aria-label={`${column.label}: ${column.items.length}`}
            >
              <div className="flex items-center gap-inline-xs">
                <Dot type={column.id} />
                <span className="min-w-0 flex-1 truncate text-2xs text-muted-foreground">
                  {column.label}
                </span>
                <span className="text-xs font-medium tabular-nums text-foreground">
                  {column.items.length}
                </span>
              </div>

              {top ? (
                <div className="space-y-stack-xs rounded-md bg-muted/60 px-inset-sm py-0.5">
                  <PriorityMark p={top.priority} />
                  <p className="line-clamp-2 break-words text-2xs text-foreground">{top.title}</p>
                </div>
              ) : (
                <div aria-hidden className="h-1.5 rounded-full border border-dashed border-border/60" />
              )}

              {slivers.map((item) => (
                <span
                  key={`${item.source}:${item.id}`}
                  aria-hidden
                  className="block h-1.5 rounded-full bg-muted-foreground/20"
                />
              ))}
              {more > 0 ? (
                <p className="text-2xs tabular-nums text-muted-foreground">+{more}</p>
              ) : null}
            </li>
          );
        })}
      </ul>

      {block.footnote ? <p className="text-2xs text-muted-foreground">{block.footnote}</p> : null}
    </section>
  );
}

export function ErgonBoard({ block, partial, condensed = false }: ErgonBoardProps) {
  if (condensed) return <ErgonBoardCondensed block={block} />;

  return <ErgonBoardView block={block} partial={partial} />;
}
