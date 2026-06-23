"use client";

import type { ErgonFilters, TaskCategoryRow } from "@/lib/ergon/types";
import type { CategoryPatch } from "@/lib/schemas/task-categories";

import { ListFilter, Settings2 } from "lucide-react";

import { CategoryManager } from "@/components/ergon/CategoryManager";
import { TaskFilters } from "@/components/ergon/TaskFilters";
import { Button } from "@/components/third-party/ui/button";
import { Input } from "@/components/third-party/ui/input";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/third-party/ui/sheet";
import { isErgonFiltersActive } from "@/lib/ergon/task-view";
import { cn } from "@/lib/utils";

type ErgonFilterSheetProps = {
  filters: ErgonFilters;
  categories: TaskCategoryRow[];
  onChange: (next: ErgonFilters) => void;
  onUpdateCategory: (id: string, patch: CategoryPatch) => Promise<TaskCategoryRow>;
  onDeleteCategory: (id: string) => Promise<void>;
  className?: string;
  /** Desktop: icon-only settings trigger in the header cluster. */
  variant?: "mobile" | "desktop";
};

export function ErgonFilterSheet({
  filters,
  categories,
  onChange,
  onUpdateCategory,
  onDeleteCategory,
  className,
  variant = "mobile",
}: ErgonFilterSheetProps) {
  const active = isErgonFiltersActive(filters);
  const isDesktop = variant === "desktop";
  const TriggerIcon = isDesktop ? Settings2 : ListFilter;

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button
          aria-label={
            isDesktop
              ? active
                ? "Filter & category settings (active)"
                : "Filter & category settings"
              : active
                ? "Filter tasks (active)"
                : "Filter tasks"
          }
          className={cn("relative shrink-0", isDesktop && "size-8", className)}
          size="icon"
          type="button"
          variant={isDesktop ? "ghost" : "outline"}
        >
          <TriggerIcon className="size-3.5" />
          {active ? (
            <span className="absolute top-1 right-1 size-1.5 rounded-full bg-primary" />
          ) : null}
        </Button>
      </SheetTrigger>
      <SheetContent
        className={cn(
          "gap-0 overflow-y-auto px-4 pb-6",
          isDesktop ? "max-w-md" : "max-h-[85dvh]"
        )}
        side={isDesktop ? "right" : "bottom"}
      >
        <SheetHeader className="pb-4 text-left">
          <SheetTitle>{isDesktop ? "Filters & categories" : "Filter & organize"}</SheetTitle>
        </SheetHeader>

        {!isDesktop ? (
          <Input
            className="mb-4 h-9"
            placeholder="Search tasks…"
            value={filters.search}
            onChange={(event) => onChange({ ...filters, search: event.target.value })}
          />
        ) : null}

        <TaskFilters categories={categories} filters={filters} onChange={onChange} />

        <div className="mt-6 border-t border-border/50 pt-4">
          <p className="mb-3 text-xs uppercase tracking-[0.16em] text-muted-foreground/70">
            Categories
          </p>
          <CategoryManager
            categories={categories}
            onDelete={onDeleteCategory}
            onUpdate={onUpdateCategory}
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}
