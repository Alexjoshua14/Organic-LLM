"use client";

import type { PopularTimesDay } from "@/lib/schemas/gen-ui/restaurant-card";

import { useMemo, useState } from "react";

import { dayLabel, getTodayDayOfWeek } from "./restaurant-card-utils";
import { spacing } from "@/lib/design-tokens/spacing";
import { cn } from "@/lib/utils";

type RestaurantCardPopularTimesProps = {
  popularTimes: PopularTimesDay[];
};

function formatHourLabel(hour: number): string {
  if (hour === 0) return "12a";
  if (hour < 12) return `${hour}a`;
  if (hour === 12) return "12p";

  return `${hour - 12}p`;
}

export function RestaurantCardPopularTimes({ popularTimes }: RestaurantCardPopularTimesProps) {
  const today = getTodayDayOfWeek();
  const defaultDay = popularTimes.find((d) => d.day === today)?.day ?? popularTimes[0]?.day;
  const [selectedDay, setSelectedDay] = useState(defaultDay);

  const dayData = useMemo(
    () => popularTimes.find((d) => d.day === selectedDay) ?? popularTimes[0],
    [popularTimes, selectedDay]
  );

  if (!dayData) return null;

  const maxOccupancy = Math.max(...dayData.bars.map((b) => b.occupancy), 1);
  const peak = dayData.bars.reduce(
    (best, bar) => (bar.occupancy > best.occupancy ? bar : best),
    dayData.bars[0]!
  );

  return (
    <section className={spacing.card.block}>
      <div className={cn("flex flex-wrap items-end justify-between", spacing.gap.sm)}>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Popular times
          </p>
          <p className="text-xs text-muted-foreground">
            Busiest around {formatHourLabel(peak.hour)} · typical pattern (not live)
          </p>
        </div>
        <div className="flex flex-wrap gap-1">
          {popularTimes.map((entry) => (
            <button
              key={entry.day}
              type="button"
              className={cn(
                "rounded-full px-2 py-0.5 text-[10px] capitalize transition-colors",
                entry.day === selectedDay
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted/50 text-muted-foreground hover:text-foreground"
              )}
              onClick={() => setSelectedDay(entry.day)}
            >
              {entry.day.slice(0, 3)}
            </button>
          ))}
        </div>
      </div>

      <div
        aria-label={`Popular times for ${dayLabel(dayData.day, today)}`}
        className="flex h-16 items-end gap-0.5 rounded-lg border border-border/40 bg-muted/15 px-2 py-2"
        role="img"
      >
        {dayData.bars.map((bar) => {
          const height = Math.max(12, Math.round((bar.occupancy / maxOccupancy) * 100));

          return (
            <div key={bar.hour} className="flex flex-1 flex-col items-center justify-end gap-1">
              <div
                className={cn(
                  "w-full max-w-3 rounded-sm bg-primary/70 transition-all",
                  bar.hour === peak.hour && "bg-primary"
                )}
                style={{ height: `${height}%` }}
                title={`${formatHourLabel(bar.hour)}: ${bar.occupancy}% busy`}
              />
              {bar.hour % 3 === 0 ? (
                <span className="text-[8px] text-muted-foreground">{formatHourLabel(bar.hour)}</span>
              ) : (
                <span className="text-[8px] opacity-0">·</span>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
