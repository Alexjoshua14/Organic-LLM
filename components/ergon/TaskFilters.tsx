"use client";

import type { ErgonFilters, TaskCategoryRow } from "@/lib/ergon/types";

import { MentalEffort, TaskPriority, TaskStatus } from "@/lib/schemas/tasks";
import { CategoryFilterChips } from "@/components/ergon/CategoryPicker";
import { Input } from "@/components/third-party/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/third-party/ui/select";
import { cn } from "@/lib/utils";

type TaskFiltersProps = {
  filters: ErgonFilters;
  categories: TaskCategoryRow[];
  onChange: (next: ErgonFilters) => void;
  className?: string;
};

const PRIORITY_OPTIONS = TaskPriority.options;
const EFFORT_OPTIONS = MentalEffort.options;
const STATUS_OPTIONS = TaskStatus.options;

function toggleValue<T extends string>(values: T[], value: T): T[] {
  return values.includes(value) ? values.filter((item) => item !== value) : [...values, value];
}

export function TaskFilters({ filters, categories, onChange, className }: TaskFiltersProps) {
  return (
    <div className={cn("space-y-3", className)}>
      <Input
        className="max-w-md"
        placeholder="Search tasks…"
        value={filters.search}
        onChange={(event) => onChange({ ...filters, search: event.target.value })}
      />

      <CategoryFilterChips
        categories={categories}
        selectedIds={filters.categoryIds}
        onToggle={(categoryId) =>
          onChange({
            ...filters,
            categoryIds: toggleValue(filters.categoryIds, categoryId),
          })
        }
      />

      <div className="flex flex-wrap gap-2">
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
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Priority" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all-priority">All priorities</SelectItem>
            {PRIORITY_OPTIONS.map((priority) => (
              <SelectItem key={priority} value={priority}>
                {priority}
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
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Effort" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all-effort">All effort</SelectItem>
            {EFFORT_OPTIONS.map((effort) => (
              <SelectItem key={effort} value={effort}>
                {effort}
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
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all-status">All status</SelectItem>
            {STATUS_OPTIONS.map((status) => (
              <SelectItem key={status} value={status}>
                {status}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
