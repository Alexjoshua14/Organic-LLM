"use client";

import type { ErgonFilters, TaskCategoryRow } from "@/lib/ergon/types";

import { CategoryFilterChips } from "@/components/ergon/CategoryPicker";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/third-party/ui/select";
import { formatTaskStatus } from "@/lib/ergon/task-status";
import { MentalEffort, TaskPriority, TaskStatus } from "@/lib/schemas/tasks";
import { cn } from "@/lib/utils";

type TaskFiltersProps = {
  filters: ErgonFilters;
  categories: TaskCategoryRow[];
  onChange: (next: ErgonFilters) => void;
  className?: string;
  /** Compact layout with smaller chips and selects (desktop toolbar). */
  compact?: boolean;
};

const PRIORITY_OPTIONS = TaskPriority.options;
const EFFORT_OPTIONS = MentalEffort.options;
const STATUS_OPTIONS = TaskStatus.options;

const COMPACT_SELECT =
  "h-8 w-[7.5rem] gap-1 border-border/50 bg-muted/20 text-xs [&>span]:truncate";

function toggleValue<T extends string>(values: T[], value: T): T[] {
  return values.includes(value) ? values.filter((item) => item !== value) : [...values, value];
}

export function TaskFilters({
  filters,
  categories,
  onChange,
  className,
  compact = false,
}: TaskFiltersProps) {
  return (
    <div className={cn(compact ? "flex flex-wrap items-center gap-2" : "space-y-3", className)}>
      <CategoryFilterChips
        categories={categories}
        compact={compact}
        selectedIds={filters.categoryIds}
        onToggle={(categoryId) =>
          onChange({
            ...filters,
            categoryIds: toggleValue(filters.categoryIds, categoryId),
          })
        }
      />

      <div className={cn("flex flex-wrap gap-2", compact && "items-center")}>
        <Select
          value={filters.priorities[0] ?? "all-priority"}
          onValueChange={(value) =>
            onChange({
              ...filters,
              priorities:
                value === "all-priority" ? [] : [value as (typeof PRIORITY_OPTIONS)[number]],
            })
          }
        >
          <SelectTrigger className={cn(!compact && "w-[140px]", compact && COMPACT_SELECT)}>
            <SelectValue placeholder="Priority" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all-priority">All priorities</SelectItem>
            {PRIORITY_OPTIONS.map((priority) => (
              <SelectItem key={priority} value={priority}>
                <span className="capitalize">{priority}</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={filters.mentalEfforts[0] ?? "all-effort"}
          onValueChange={(value) =>
            onChange({
              ...filters,
              mentalEfforts:
                value === "all-effort" ? [] : [value as (typeof EFFORT_OPTIONS)[number]],
            })
          }
        >
          <SelectTrigger className={cn(!compact && "w-[140px]", compact && COMPACT_SELECT)}>
            <SelectValue placeholder="Effort" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all-effort">All effort</SelectItem>
            {EFFORT_OPTIONS.map((effort) => (
              <SelectItem key={effort} value={effort}>
                <span className="capitalize">{effort}</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={filters.statuses[0] ?? "all-status"}
          onValueChange={(value) =>
            onChange({
              ...filters,
              statuses: value === "all-status" ? [] : [value as (typeof STATUS_OPTIONS)[number]],
            })
          }
        >
          <SelectTrigger className={cn(!compact && "w-[140px]", compact && COMPACT_SELECT)}>
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all-status">All status</SelectItem>
            {STATUS_OPTIONS.map((status) => (
              <SelectItem key={status} value={status}>
                {formatTaskStatus(status)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
