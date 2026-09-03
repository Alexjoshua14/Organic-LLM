"use client";

import type { PrepPlacement, PrepRecipe, PrepSlot } from "@/lib/schemas/prep";
import type { RemySlotKey } from "./RemyWeekGrid";

import { utcDateFromIso } from "@/lib/prep";
import { Button } from "@/components/third-party/ui/button";
import { Label } from "@/components/third-party/ui/label";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/third-party/ui/sheet";

const SLOT_LABEL: Record<PrepSlot, string> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
};

function slotHeading(key: RemySlotKey): string {
  const day = utcDateFromIso(key.date);
  const weekday = day.toLocaleString("en-US", { weekday: "long", timeZone: "UTC" });

  return `${SLOT_LABEL[key.slot]} · ${weekday} ${day.getUTCDate()}`;
}

export type RemyAskContext = {
  date?: string;
  slot?: PrepSlot;
  recipeTitle?: string;
};

type RemySlotPanelProps = {
  open: boolean;
  slot: RemySlotKey | null;
  library: PrepRecipe[];
  cookPlacements: PrepPlacement[];
  recipes: Record<string, PrepRecipe>;
  onClose: () => void;
  onAssignRecipe: (recipeId: string) => void;
  onAssignLeftover: (sourcePlacementId: string) => void;
  onAskRemy: (ctx: RemyAskContext) => void;
};

export function RemySlotPanel({
  open,
  slot,
  library,
  cookPlacements,
  recipes,
  onClose,
  onAssignRecipe,
  onAssignLeftover,
  onAskRemy,
}: RemySlotPanelProps) {
  return (
    <Sheet open={open} onOpenChange={(next) => !next && onClose()}>
      <SheetContent className="flex flex-col gap-4 overflow-y-auto sm:max-w-md" side="right">
        <SheetHeader>
          <SheetTitle>{slot ? slotHeading(slot) : "Assign meal"}</SheetTitle>
        </SheetHeader>

        <div className="space-y-stack-sm">
          <Button
            variant="outline"
            onClick={() => slot && onAskRemy({ date: slot.date, slot: slot.slot })}
          >
            Ask Remy
          </Button>
        </div>

        <div className="space-y-stack-sm">
          <Label>From library</Label>
          {library.length === 0 ? (
            <p className="text-sm text-muted-foreground">No recipes yet — add one in Library.</p>
          ) : (
            <ul className="space-y-stack-xs">
              {library.map((recipe) => (
                <li key={recipe.id}>
                  <button
                    className="w-full rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted/50"
                    type="button"
                    onClick={() => onAssignRecipe(recipe.id)}
                  >
                    {recipe.title}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="space-y-stack-sm">
          <Label>Leftover of</Label>
          <p className="text-xs text-muted-foreground">
            Points this slot at a cook meal. Shopping counts the cook once.
          </p>
          {cookPlacements.length === 0 ? (
            <p className="text-sm text-muted-foreground">Place a cook meal first.</p>
          ) : (
            <ul className="space-y-stack-xs">
              {cookPlacements.map((placement) => {
                const recipe = recipes[placement.recipeId];
                const day = utcDateFromIso(placement.date);

                return (
                  <li key={placement.id}>
                    <button
                      className="w-full rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted/50"
                      type="button"
                      onClick={() => onAssignLeftover(placement.id)}
                    >
                      {recipe?.title ?? "Recipe"} · {SLOT_LABEL[placement.slot]}{" "}
                      {day.toLocaleString("en-US", { weekday: "short", timeZone: "UTC" })}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

export { SLOT_LABEL };
