"use client";

import type { PrepWeekIngredient } from "@/lib/schemas/prep";
import type { ShoppingItemLocation } from "@/components/chat/gen-ui/blocks/ShoppingList";

import { ShoppingList } from "@/components/chat/gen-ui/blocks/ShoppingList";
import { buildPrepShoppingList } from "@/lib/prep";

type RemyShoppingViewProps = {
  weekLabel: string;
  ingredients: PrepWeekIngredient[];
  onToggleChecked: (identity: string, checked: boolean) => void;
  onToggleStatus: (identity: string, status: "have" | "need") => void;
};

export function RemyShoppingView({
  weekLabel,
  ingredients,
  onToggleChecked,
  onToggleStatus,
}: RemyShoppingViewProps) {
  if (ingredients.length === 0) {
    return (
      <p className="py-12 text-center text-sm text-muted-foreground">
        No shopping rows for this week. Cook placements (not leftovers) fill this list.
      </p>
    );
  }

  const { block, identities } = buildPrepShoppingList(ingredients, `Shopping · ${weekLabel}`);

  const identityAt = (loc: ShoppingItemLocation) => identities[loc.groupIndex]?.[loc.itemIndex];

  return (
    <ShoppingList
      block={block}
      onToggleChecked={(loc) => {
        const identity = identityAt(loc);
        const item = block.groups[loc.groupIndex]?.items[loc.itemIndex];

        if (!identity || !item) return;
        onToggleChecked(identity, !item.checked);
      }}
      onToggleStatus={(loc) => {
        const identity = identityAt(loc);
        const item = block.groups[loc.groupIndex]?.items[loc.itemIndex];

        if (!identity || !item) return;
        onToggleStatus(identity, item.status === "have" ? "need" : "have");
      }}
    />
  );
}
