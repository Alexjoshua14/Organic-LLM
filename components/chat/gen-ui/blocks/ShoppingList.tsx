"use client";

import type { ShoppingListBlock } from "@/lib/schemas/gen-ui";

import { Check, Square } from "lucide-react";

import { cn } from "@/lib/utils";

/** Where an item sits in the block, so callers can map back to their own state. */
export type ShoppingItemLocation = { groupIndex: number; itemIndex: number };

type ShoppingListProps = {
  block: ShoppingListBlock;
  partial?: boolean;
  /** When provided, the checkbox becomes an interactive toggle (used by the mise view). */
  onToggleChecked?: (loc: ShoppingItemLocation) => void;
  /** When provided, the have/need pill becomes an interactive toggle. */
  onToggleStatus?: (loc: ShoppingItemLocation) => void;
};

function itemText(name: string, quantity?: string, unit?: string): string {
  const qty = [quantity, unit].filter(Boolean).join(" ").trim();

  return qty ? `${qty} ${name}` : name;
}

export function ShoppingList({
  block,
  partial,
  onToggleChecked,
  onToggleStatus,
}: ShoppingListProps) {
  const needCount = block.groups
    .flatMap((g) => g.items)
    .filter((i) => i.status === "need" && !i.checked).length;

  return (
    <div className="space-y-3">
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-sm font-semibold text-foreground">{block.title}</p>
        <span className="text-[11px] text-muted-foreground">{needCount} still to buy</span>
      </div>

      <div className="space-y-3">
        {block.groups.map((group, groupIndex) => (
          <div key={group.category}>
            <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              {group.category}
            </p>
            <ul className="space-y-1">
              {group.items.map((item, itemIndex) => {
                const Box = item.checked ? Check : Square;
                const checkboxClasses =
                  "flex items-center justify-center size-4 shrink-0 rounded border border-border/60 text-muted-foreground";

                return (
                  <li
                    key={`${item.name}-${itemIndex}`}
                    className="flex items-center gap-2 text-xs text-foreground"
                  >
                    {onToggleChecked ? (
                      <button
                        aria-label={item.checked ? "Mark as not picked up" : "Mark as picked up"}
                        aria-pressed={item.checked ?? false}
                        className={cn(checkboxClasses, "hover:text-foreground")}
                        type="button"
                        onClick={() => onToggleChecked({ groupIndex, itemIndex })}
                      >
                        <Box className="size-3" />
                      </button>
                    ) : (
                      <span aria-hidden className={checkboxClasses}>
                        <Box className="size-3" />
                      </span>
                    )}

                    <span className={cn("flex-1", item.checked && "line-through opacity-60")}>
                      {itemText(item.name, item.quantity, item.unit)}
                      {item.recipe ? (
                        <span className="text-muted-foreground"> — {item.recipe}</span>
                      ) : null}
                    </span>

                    {onToggleStatus ? (
                      <button
                        className={cn(
                          "rounded-full px-2 py-0.5 text-[10px] font-medium",
                          item.status === "have"
                            ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                            : "bg-amber-500/15 text-amber-700 dark:text-amber-300"
                        )}
                        type="button"
                        onClick={() => onToggleStatus({ groupIndex, itemIndex })}
                      >
                        {item.status === "have" ? "have" : "need"}
                      </button>
                    ) : (
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-[10px] font-medium",
                          item.status === "have"
                            ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                            : "bg-amber-500/15 text-amber-700 dark:text-amber-300"
                        )}
                      >
                        {item.status === "have" ? "have" : "need"}
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>

      {partial ? <div className="h-3 w-1/2 rounded bg-muted/40 animate-pulse" /> : null}
    </div>
  );
}
