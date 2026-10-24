"use client";

import type { PrepRecipe } from "@/lib/schemas/prep";

import { Beef, ChefHat, Timer, Wheat } from "lucide-react";

import { glass } from "@/components/design-system/primitives";
import { RECIPE_COMPLEXITY_LABEL } from "@/lib/schemas/gen-ui/recipe-card";
import { cn } from "@/lib/utils";

type RemyGlanceCellProps = {
  recipe: PrepRecipe;
  leftover: boolean;
  selected?: boolean;
  onClick: () => void;
};

export function RemyGlanceCell({ recipe, leftover, selected, onClick }: RemyGlanceCellProps) {
  return (
    <button
      className={cn(
        glass({ border: "all" }),
        "flex h-full min-h-[7.5rem] w-full flex-col items-start gap-1 rounded-lg p-inset-sm text-left",
        "hover:bg-muted/40",
        selected && "ring-2 ring-ring"
      )}
      type="button"
      onClick={onClick}
    >
      <div className="flex w-full items-start justify-between gap-1">
        <p className="line-clamp-2 text-xs font-medium text-foreground">{recipe.title}</p>
        {leftover ? (
          <span className="shrink-0 rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-medium text-amber-800 dark:text-amber-200">
            Leftover
          </span>
        ) : null}
      </div>
      <div className="mt-auto flex flex-wrap gap-x-2 gap-y-0.5 text-[10px] text-muted-foreground">
        {recipe.complexity ? (
          <span className="inline-flex items-center gap-0.5">
            <ChefHat className="size-2.5" />
            {RECIPE_COMPLEXITY_LABEL[recipe.complexity]}
          </span>
        ) : null}
        {recipe.duration ? (
          <span className="inline-flex items-center gap-0.5">
            <Timer className="size-2.5" />
            {recipe.duration}
          </span>
        ) : null}
        {recipe.mainProtein ? (
          <span className="inline-flex items-center gap-0.5">
            <Beef className="size-2.5" />
            {recipe.mainProtein}
          </span>
        ) : null}
        {recipe.mainCarbs ? (
          <span className="inline-flex items-center gap-0.5">
            <Wheat className="size-2.5" />
            {recipe.mainCarbs}
          </span>
        ) : null}
      </div>
    </button>
  );
}
