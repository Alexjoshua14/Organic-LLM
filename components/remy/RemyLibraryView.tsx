"use client";

import type { PrepRecipe, PrepSlot } from "@/lib/schemas/prep";

import { useMemo, useState } from "react";

import { SLOT_LABEL } from "./RemySlotPanel";

import { RecipeCard } from "@/components/chat/gen-ui/blocks/RecipeCard";
import { glass } from "@/components/design-system/primitives";
import { Button } from "@/components/third-party/ui/button";
import { Label } from "@/components/third-party/ui/label";
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/third-party/ui/sheet";
import { PREP_SLOTS } from "@/lib/schemas/prep";
import { prepRecipeToBlock, utcDateFromIso, weekDates } from "@/lib/prep";
import { cn } from "@/lib/utils";

type RemyLibraryViewProps = {
  recipes: PrepRecipe[];
  weekStart: string;
  onCreate: () => void;
  onEdit: (recipe: PrepRecipe) => void;
  onDelete: (recipe: PrepRecipe) => void;
  onPlace: (recipeId: string, date: string, slot: PrepSlot) => void;
};

export function RemyLibraryView({
  recipes,
  weekStart,
  onCreate,
  onEdit,
  onDelete,
  onPlace,
}: RemyLibraryViewProps) {
  const [placing, setPlacing] = useState<PrepRecipe | null>(null);
  const [date, setDate] = useState(weekStart);
  const [slot, setSlot] = useState<PrepSlot>("dinner");
  const dates = useMemo(() => weekDates(weekStart), [weekStart]);

  return (
    <div className="space-y-stack-md">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{recipes.length} recipes</p>
        <Button size="sm" onClick={onCreate}>
          New recipe
        </Button>
      </div>

      {recipes.length === 0 ? (
        <p className="py-12 text-center text-sm text-muted-foreground">
          Library is empty. Create a card or ask Remy to add one.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-inline-md lg:grid-cols-2">
          {recipes.map((recipe) => (
            <div
              key={recipe.id}
              className={cn(glass({ opaque: true }), "flex flex-col gap-3 rounded-xl p-inset-md")}
            >
              <RecipeCard block={prepRecipeToBlock(recipe)} />
              <div className="flex flex-wrap gap-inline-sm">
                <Button size="sm" variant="outline" onClick={() => onEdit(recipe)}>
                  Edit
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setPlacing(recipe);
                    setDate(weekStart);
                    setSlot("dinner");
                  }}
                >
                  Place on week
                </Button>
                <Button size="sm" variant="ghost" onClick={() => onDelete(recipe)}>
                  Delete
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Sheet open={placing !== null} onOpenChange={(next) => !next && setPlacing(null)}>
        <SheetContent className="sm:max-w-sm" side="right">
          <SheetHeader>
            <SheetTitle>Place on this week</SheetTitle>
          </SheetHeader>
          <p className="text-sm text-muted-foreground">{placing?.title}</p>
          <div className="space-y-stack-sm">
            <div className="space-y-stack-xs">
              <Label htmlFor="remy-place-date">Day</Label>
              <select
                className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                id="remy-place-date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              >
                {dates.map((d) => {
                  const utc = utcDateFromIso(d);

                  return (
                    <option key={d} value={d}>
                      {utc.toLocaleString("en-US", { weekday: "short", timeZone: "UTC" })}{" "}
                      {utc.getUTCDate()}
                    </option>
                  );
                })}
              </select>
            </div>
            <div className="space-y-stack-xs">
              <Label htmlFor="remy-place-slot">Slot</Label>
              <select
                className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                id="remy-place-slot"
                value={slot}
                onChange={(e) => setSlot(e.target.value as PrepSlot)}
              >
                {PREP_SLOTS.map((s) => (
                  <option key={s} value={s}>
                    {SLOT_LABEL[s]}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <SheetFooter>
            <Button variant="ghost" onClick={() => setPlacing(null)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (!placing) return;
                onPlace(placing.id, date, slot);
                setPlacing(null);
              }}
            >
              Place
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}
