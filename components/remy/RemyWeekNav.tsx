"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/third-party/ui/button";
import { formatWeekRange } from "@/lib/prep";
import { cn } from "@/lib/utils";

type RemyWeekNavProps = {
  weekStart: string;
  onPrev: () => void;
  onThisWeek: () => void;
  onNext: () => void;
  className?: string;
};

export function RemyWeekNav({
  weekStart,
  onPrev,
  onThisWeek,
  onNext,
  className,
}: RemyWeekNavProps) {
  return (
    <div className={cn("flex items-center gap-inline-sm", className)}>
      <Button aria-label="Previous week" size="icon" variant="ghost" onClick={onPrev}>
        <ChevronLeft />
      </Button>
      <p className="min-w-[10.5rem] text-center text-sm text-foreground">
        {formatWeekRange(weekStart)}
      </p>
      <Button aria-label="Next week" size="icon" variant="ghost" onClick={onNext}>
        <ChevronRight />
      </Button>
      <Button size="sm" variant="outline" onClick={onThisWeek}>
        This week
      </Button>
    </div>
  );
}
