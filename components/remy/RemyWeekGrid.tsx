"use client";

import type { PrepPlacement, PrepRecipe, PrepSlot } from "@/lib/schemas/prep";

import { RemyGlanceCell } from "./RemyGlanceCell";

import { PREP_SLOTS } from "@/lib/schemas/prep";
import { REMY_WEEK_GRID_COLS_CLASS, REMY_WEEK_GRID_MIN_WIDTH_REM } from "@/lib/remy/remy-layout";
import { localCalendarIso, utcDateFromIso, weekDates } from "@/lib/prep";
import { glass } from "@/components/design-system/primitives";
import { cn } from "@/lib/utils";

const SLOT_LABEL: Record<PrepSlot, string> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
};

const DAY_LABEL = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

export type RemySlotKey = { date: string; slot: PrepSlot };

type RemyWeekGridProps = {
  weekStart: string;
  placements: PrepPlacement[];
  recipes: Record<string, PrepRecipe>;
  selected: RemySlotKey | null;
  onSelectFilled: (key: RemySlotKey, placement: PrepPlacement) => void;
  onSelectEmpty: (key: RemySlotKey) => void;
};

function placementAt(
  placements: PrepPlacement[],
  date: string,
  slot: PrepSlot
): PrepPlacement | undefined {
  return placements.find((p) => p.date === date && p.slot === slot);
}

function SlotCell({
  date,
  slot,
  placement,
  recipe,
  isSelected,
  onSelectFilled,
  onSelectEmpty,
}: {
  date: string;
  slot: PrepSlot;
  placement: PrepPlacement | undefined;
  recipe: PrepRecipe | undefined;
  isSelected: boolean;
  onSelectFilled: (key: RemySlotKey, placement: PrepPlacement) => void;
  onSelectEmpty: (key: RemySlotKey) => void;
}) {
  if (placement && recipe) {
    return (
      <RemyGlanceCell
        leftover={Boolean(placement.leftoverOfPlacementId)}
        recipe={recipe}
        selected={isSelected}
        onClick={() => onSelectFilled({ date, slot }, placement)}
      />
    );
  }

  if (placement) {
    return (
      <button
        className={cn(
          glass({ border: "all" }),
          "flex h-full min-h-[7.5rem] w-full items-center rounded-lg p-inset-sm text-left text-xs text-muted-foreground",
          isSelected && "ring-2 ring-ring"
        )}
        type="button"
        onClick={() => onSelectFilled({ date, slot }, placement)}
      >
        Recipe unavailable
      </button>
    );
  }

  return (
    <button
      className={cn(
        "flex h-full min-h-[7.5rem] w-full flex-col items-start justify-center rounded-lg border border-dashed border-border/70 p-inset-sm text-left",
        "text-[11px] text-muted-foreground hover:bg-muted/30",
        isSelected && "ring-2 ring-ring"
      )}
      type="button"
      onClick={() => onSelectEmpty({ date, slot })}
    >
      Assign from library
      <span className="mt-0.5 text-[10px] text-muted-foreground/80">or ask Remy</span>
    </button>
  );
}

export function RemyWeekGrid({
  weekStart,
  placements,
  recipes,
  selected,
  onSelectFilled,
  onSelectEmpty,
}: RemyWeekGridProps) {
  const dates = weekDates(weekStart);
  const today = localCalendarIso();

  return (
    <div className="min-w-0">
      {/* Stacked days — phone / narrow; breakpoint sync: REMY_WEEK_GRID_MIN_WIDTH_PX */}
      <div className="flex flex-col gap-stack-lg lg:hidden">
        {dates.map((date, i) => {
          const day = utcDateFromIso(date);
          const isToday = date === today;

          return (
            <section
              key={date}
              className={cn(
                "min-w-0 space-y-stack-sm rounded-xl p-inset-sm",
                isToday && "bg-muted/40"
              )}
            >
              <header className="flex items-baseline gap-inline-sm px-1">
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                  {DAY_LABEL[i]}
                </p>
                <p className="text-sm font-medium text-foreground">{day.getUTCDate()}</p>
                {isToday ? (
                  <span className="text-[10px] uppercase tracking-wide text-muted-foreground/80">
                    Today
                  </span>
                ) : null}
              </header>
              <div className="flex flex-col gap-inline-sm">
                {PREP_SLOTS.map((slot) => {
                  const placement = placementAt(placements, date, slot);
                  const isSelected = selected?.date === date && selected.slot === slot;
                  const recipe = placement ? recipes[placement.recipeId] : undefined;

                  return (
                    <div key={`${date}-${slot}`} className="min-w-0">
                      <p className="mb-1 px-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                        {SLOT_LABEL[slot]}
                      </p>
                      <div className="min-h-[7.5rem]">
                        <SlotCell
                          date={date}
                          isSelected={isSelected}
                          placement={placement}
                          recipe={recipe}
                          slot={slot}
                          onSelectEmpty={onSelectEmpty}
                          onSelectFilled={onSelectFilled}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>

      {/* 7-day grid — desktop; keeps wide columns readable */}
      <div className="hidden min-w-0 overflow-x-auto lg:block">
        <div
          className={cn("grid gap-inline-sm", REMY_WEEK_GRID_COLS_CLASS)}
          style={{ minWidth: `${REMY_WEEK_GRID_MIN_WIDTH_REM}rem` }}
        >
          <div />
          {dates.map((date, i) => {
            const day = utcDateFromIso(date);

            return (
              <div
                key={date}
                className={cn("rounded-md px-2 py-1 text-center", date === today && "bg-muted/50")}
              >
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                  {DAY_LABEL[i]}
                </p>
                <p className="text-sm text-foreground">{day.getUTCDate()}</p>
              </div>
            );
          })}

          {PREP_SLOTS.map((slot) => (
            <div key={slot} className="contents">
              <div className="flex items-center pr-2">
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  {SLOT_LABEL[slot]}
                </p>
              </div>
              {dates.map((date) => {
                const placement = placementAt(placements, date, slot);
                const isSelected = selected?.date === date && selected.slot === slot;
                const recipe = placement ? recipes[placement.recipeId] : undefined;

                return (
                  <div key={`${date}-${slot}`} className="min-h-[7.5rem] min-w-0">
                    <SlotCell
                      date={date}
                      isSelected={isSelected}
                      placement={placement}
                      recipe={recipe}
                      slot={slot}
                      onSelectEmpty={onSelectEmpty}
                      onSelectFilled={onSelectFilled}
                    />
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
