"use client";

import type { RestaurantHours } from "@/lib/schemas/gen-ui/restaurant-card";

import { useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";

import {
  dayLabel,
  findHoursForDay,
  formatHoursDay,
  getTodayDayOfWeek,
  resolveKitchenHoursForDay,
  resolveTodayHours,
  sortDaysMondayFirst,
} from "./restaurant-card-utils";
import { spacing } from "@/lib/design-tokens/spacing";
import { cn } from "@/lib/utils";

type RestaurantCardHoursProps = {
  hours: RestaurantHours;
};

export function RestaurantCardHours({ hours }: RestaurantCardHoursProps) {
  const [expanded, setExpanded] = useState(false);
  const today = getTodayDayOfWeek();
  const todayInfo = useMemo(() => resolveTodayHours(hours), [hours]);
  const kitchenToday = resolveKitchenHoursForDay(hours, today);
  const week = useMemo(() => sortDaysMondayFirst(hours.regular), [hours.regular]);

  return (
    <section className={spacing.card.block}>
      <div className={cn("flex items-start justify-between", spacing.gap.sm)}>
        <div className={spacing.card.labelStack}>
          <p className="text-2xs font-semibold uppercase tracking-wide text-muted-foreground">
            Hours
          </p>
          <p className={cn("text-sm font-medium", todayInfo.isClosed && "text-destructive")}>
            {todayInfo.label}
          </p>
          {todayInfo.detail ? (
            <p className="text-xs text-muted-foreground">{todayInfo.detail}</p>
          ) : null}
          {kitchenToday ? (
            <p className="text-xs text-muted-foreground">Kitchen: {kitchenToday}</p>
          ) : null}
        </div>
        <button
          type="button"
          aria-expanded={expanded}
          className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] text-muted-foreground hover:bg-muted/40 hover:text-foreground"
          onClick={() => setExpanded((v) => !v)}
        >
          Full week
          <ChevronDown className={cn("size-3 transition-transform", expanded && "rotate-180")} />
        </button>
      </div>

      {expanded ? (
        <ul className={cn(spacing.card.listItems, "rounded-lg border border-border/50 bg-muted/20 px-3 py-2 text-xs")}>
          {week.map((entry) => {
            const kitchen = findHoursForDay(hours.kitchen, entry.day);

            return (
              <li key={entry.day} className={cn("flex items-baseline justify-between", spacing.gap.md)}>
                <span
                  className={cn(
                    "font-medium",
                    entry.day === today ? "text-foreground" : "text-muted-foreground"
                  )}
                >
                  {dayLabel(entry.day, today)}
                </span>
                <span className="text-right text-foreground/90">
                  {formatHoursDay(entry)}
                  {kitchen ? (
                    <span className="block text-2xs text-muted-foreground">
                      Kitchen: {formatHoursDay(kitchen)}
                    </span>
                  ) : null}
                </span>
              </li>
            );
          })}
        </ul>
      ) : null}
    </section>
  );
}
