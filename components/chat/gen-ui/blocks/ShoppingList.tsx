"use client";

import type { ShoppingListBlock } from "@/lib/schemas/gen-ui";

import { useState } from "react";
import { Check, Square } from "lucide-react";

import { cn } from "@/lib/utils";

/** Where an item sits in the block, so callers can map back to their own state. */
export type ShoppingItemLocation = { groupIndex: number; itemIndex: number };

type ShoppingListProps = {
  block: ShoppingListBlock;
  partial?: boolean;
  /**
   * When provided, the checkbox is controlled by the caller (used by the mise view): `block`
   * already carries the state. When omitted, the list keeps the tick in local view state.
   */
  onToggleChecked?: (loc: ShoppingItemLocation) => void;
  /** Same split for the have/need pill: caller-controlled when provided, local when omitted. */
  onToggleStatus?: (loc: ShoppingItemLocation) => void;
};

type LocalItemState = { checked?: boolean; status?: "have" | "need" };

/**
 * Local toggles for lists no caller controls (chat, the Gen UI Lab). Not persisted: they last
 * until the block changes or the component unmounts. Keyed by position and tied to the block they
 * were made on, so a regenerated list never inherits ticks meant for another one.
 */
function useLocalItemState(block: ShoppingListBlock) {
  const [local, setLocal] = useState<{
    block: ShoppingListBlock;
    items: Record<string, LocalItemState>;
  }>({ block, items: {} });
  const items = local.block === block ? local.items : {};

  const update = (loc: ShoppingItemLocation, change: (current: LocalItemState) => LocalItemState) =>
    setLocal((previous) => {
      const base = previous.block === block ? previous.items : {};
      const key = `${loc.groupIndex}:${loc.itemIndex}`;

      return { block, items: { ...base, [key]: change(base[key] ?? {}) } };
    });

  return { items, update };
}

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
  const local = useLocalItemState(block);
  const toggleChecked =
    onToggleChecked ??
    ((loc: ShoppingItemLocation) =>
      local.update(loc, (current) => {
        const item = block.groups[loc.groupIndex]?.items[loc.itemIndex];

        return { ...current, checked: !(current.checked ?? item?.checked ?? false) };
      }));
  const toggleStatus =
    onToggleStatus ??
    ((loc: ShoppingItemLocation) =>
      local.update(loc, (current) => {
        const item = block.groups[loc.groupIndex]?.items[loc.itemIndex];
        const status = current.status ?? item?.status ?? "need";

        return { ...current, status: status === "have" ? "need" : "have" };
      }));
  // Local state only applies to a control the caller does not own.
  const resolve = (
    groupIndex: number,
    itemIndex: number,
    item: ShoppingListBlock["groups"][number]["items"][number]
  ) => {
    const state = local.items[`${groupIndex}:${itemIndex}`];

    return {
      checked: onToggleChecked ? item.checked : (state?.checked ?? item.checked),
      status: onToggleStatus ? item.status : (state?.status ?? item.status),
    };
  };
  const needCount = block.groups
    .flatMap((g, gi) => g.items.map((item, ii) => resolve(gi, ii, item)))
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
            <p className="mb-1.5 text-2xs font-semibold uppercase tracking-wide text-muted-foreground">
              {group.category}
            </p>
            <ul className="space-y-1">
              {group.items.map((rawItem, itemIndex) => {
                const item = { ...rawItem, ...resolve(groupIndex, itemIndex, rawItem) };
                const Box = item.checked ? Check : Square;
                const checkboxClasses =
                  "flex items-center justify-center size-4 shrink-0 rounded border border-border/60 text-muted-foreground";

                return (
                  <li
                    key={`${item.name}-${itemIndex}`}
                    className="flex items-center gap-2 text-xs text-foreground"
                  >
                    {/* Interactive unless `partial`: a streaming list can still change under the user. */}
                    {partial ? (
                      <span aria-hidden className={checkboxClasses}>
                        <Box className="size-3" />
                      </span>
                    ) : (
                      <button
                        aria-label={item.checked ? "Mark as not picked up" : "Mark as picked up"}
                        aria-pressed={item.checked ?? false}
                        className={cn(
                          checkboxClasses,
                          "hover:bg-muted/40 hover:text-foreground focus-visible:bg-foreground focus-visible:text-background focus-visible:outline-none"
                        )}
                        type="button"
                        onClick={() => toggleChecked({ groupIndex, itemIndex })}
                      >
                        <Box className="size-3" />
                      </button>
                    )}

                    <span className={cn("flex-1", item.checked && "line-through opacity-60")}>
                      {itemText(item.name, item.quantity, item.unit)}
                      {item.recipe ? (
                        <span className="text-muted-foreground"> — {item.recipe}</span>
                      ) : null}
                    </span>

                    {!partial ? (
                      <button
                        className={cn(
                          "rounded-full px-2 py-0.5 text-2xs font-medium focus-visible:outline-none focus-visible:underline",
                          item.status === "have"
                            ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                            : "bg-amber-500/15 text-amber-700 dark:text-amber-300"
                        )}
                        type="button"
                        onClick={() => toggleStatus({ groupIndex, itemIndex })}
                      >
                        {item.status === "have" ? "have" : "need"}
                      </button>
                    ) : (
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-2xs font-medium",
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
