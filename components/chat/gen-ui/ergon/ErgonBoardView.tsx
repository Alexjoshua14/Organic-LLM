"use client";

import type { ErgonBoardBlock, ErgonStateType } from "@/lib/schemas/gen-ui";

import { useMemo, useState } from "react";

import { useErgonAction } from "./actions";
import { Button, Chip, Dot, PriorityMark, minutes } from "./primitives";

import { spacing } from "@/lib/design-tokens/spacing";
import { cn } from "@/lib/utils";

const FILTER_FOCUS =
  "organic-focus focus-visible:outline-none focus-visible:bg-foreground focus-visible:text-background";

type ErgonBoardViewProps = {
  block: ErgonBoardBlock;
  partial?: boolean;
};

export function ErgonBoardView({ block }: ErgonBoardViewProps) {
  const act = useErgonAction();
  const order = block.columns.map((c) => c.id);
  const firstFilled = block.columns.find((c) =>
    block.items.some((i) => i.stateType === c.id)
  )?.id;
  const [selected, setCol] = useState<ErgonStateType | undefined>(block.activeColumn);
  const col = order.find((id) => id === selected) ?? firstFilled ?? order[0];
  const [open, setOpen] = useState<string | null>(null);

  const items = useMemo(
    () => (col ? block.items.filter((i) => i.stateType === col) : []),
    [block.items, col]
  );
  const nextCol = (s: ErgonStateType) => {
    const index = order.indexOf(s);

    return index >= 0 ? block.columns[index + 1] : undefined;
  };

  return (
    <section className={cn("w-full rounded-2xl bg-muted/30 p-inset-md", spacing.card.section)}>
      <h3 className="text-sm font-medium text-foreground">{block.title}</h3>

      <div className="flex gap-2 overflow-x-auto pb-1" role="group" aria-label="Work status">
        {block.columns.map((column) => {
          const count = block.items.filter((item) => item.stateType === column.id).length;

          return (
            <button
              key={column.id}
              type="button"
              aria-pressed={col === column.id}
              onClick={() => {
                setCol(column.id);
                setOpen(null);
              }}
              className={cn(
                "flex min-h-11 shrink-0 items-center gap-2 rounded-full px-3 text-xs",
                col === column.id
                  ? "bg-accent/20 text-foreground"
                  : "bg-muted/50 text-muted-foreground",
                FILTER_FOCUS
              )}
            >
              <Dot type={column.id} />
              {column.label}{" "}
              <span className="tabular-nums opacity-70">{count}</span>
            </button>
          );
        })}
      </div>

      {items.length === 0 ? (
        <p className="px-1 py-3 text-sm text-muted-foreground">No items here.</p>
      ) : null}

      <ul className={spacing.card.blockItems}>
        {items.map((item) => {
          const key = `${item.source}:${item.id}`;
          const expanded = open === key;
          const next = nextCol(item.stateType);
          const duration = minutes(item.estMinutes);

          return (
            <li key={key} className="rounded-xl bg-muted/40">
              <button
                type="button"
                aria-expanded={expanded}
                onClick={() => setOpen(expanded ? null : key)}
                className={cn(
                  "flex min-h-11 w-full items-center gap-3 p-3 text-left",
                  FILTER_FOCUS
                )}
              >
                <PriorityMark p={item.priority} />
                <span className="min-w-0 flex-1">
                  <span className="block break-words text-sm text-foreground">{item.title}</span>
                  <span className="block text-xs text-muted-foreground">
                    {[item.source === "ticket" ? item.id : "Personal todo", item.group, item.state]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                </span>
                <span aria-hidden="true">{expanded ? "−" : "+"}</span>
              </button>

              {expanded ? (
                <div className={cn("px-3 pb-3", spacing.card.blockItems)}>
                  <div className="flex flex-wrap gap-1.5">
                    {item.due ? <Chip>Due {item.due}</Chip> : null}
                    {item.planned ? <Chip>Planned {item.planned}</Chip> : null}
                    {duration ? <Chip>{duration}</Chip> : null}
                    {item.assignee ? <Chip>{item.assignee}</Chip> : null}
                  </div>
                  {item.notes ? (
                    <p className="whitespace-pre-wrap break-words text-sm text-muted-foreground">
                      {item.notes}
                    </p>
                  ) : null}
                  <div className="flex flex-wrap gap-2">
                    {item.source === "ticket" &&
                    item.stateType !== "done" &&
                    next &&
                    next.id !== "done" ? (
                      <Button
                        onClick={() =>
                          act({
                            type: "move",
                            item,
                            to: next.id,
                            toLabel: next.label,
                          })
                        }
                      >
                        Move to {next.label}
                      </Button>
                    ) : null}
                    {item.stateType !== "done" ? (
                      <Button tone="action" onClick={() => act({ type: "complete", item })}>
                        Mark done
                      </Button>
                    ) : null}
                    {item.href ? (
                      <Button onClick={() => act({ type: "open", item })}>Open</Button>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
      {block.footnote ? (
        <p className="text-xs text-muted-foreground">{block.footnote}</p>
      ) : null}
    </section>
  );
}
