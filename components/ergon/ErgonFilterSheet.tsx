"use client";

import type { ErgonFilters, TaskCategoryRow } from "@/lib/ergon/types";
import type { CategoryPatch } from "@/lib/schemas/task-categories";

import { ListFilter } from "lucide-react";

import { CategoryManager } from "@/components/ergon/CategoryManager";
import { TaskFilters } from "@/components/ergon/TaskFilters";
import { Button } from "@/components/third-party/ui/button";
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
};

/** Mobile-only filter + category management in a bottom sheet. */
export function ErgonFilterSheet({
  filters,
  categories,
  onChange,
  onUpdateCategory,
  onDeleteCategory,
  className,
}: ErgonFilterSheetProps) {
  const active = isErgonFiltersActive(filters);

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button
          aria-label={active ? "Filter tasks (active)" : "Filter tasks"}
          className={cn("relative shrink-0", className)}
          size="icon"
          type="button"
          variant="outline"
        >
          <ListFilter className="size-4" />
          {active ? (
            <span className="absolute top-1.5 right-1.5 size-1.5 rounded-full bg-primary" />
          ) : null}
        </Button>
      </SheetTrigger>
      <SheetContent className="max-h-[85dvh] gap-0 overflow-y-auto px-4 pb-6" side="bottom">
        <SheetHeader className="pb-4 text-left">
          <SheetTitle>Filter & organize</SheetTitle>
        </SheetHeader>
        <TaskFilters categories={categories} filters={filters} onChange={onChange} />
        <div className="mt-6 border-t border-border/50 pt-4">
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
