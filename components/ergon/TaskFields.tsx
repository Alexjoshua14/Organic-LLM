"use client";

import type { TaskCategoryRow } from "@/lib/ergon/types";
import type { TaskFormController } from "@/lib/ergon/use-task-form";

import { CategoryPicker } from "@/components/ergon/CategoryPicker";
import { Button } from "@/components/third-party/ui/button";
import { Input } from "@/components/third-party/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/third-party/ui/select";
import { Switch } from "@/components/third-party/ui/switch";
import { Textarea } from "@/components/third-party/ui/textarea";
import { formatTaskStatus } from "@/lib/ergon/task-status";
import { MentalEffort, TaskPriority, TaskStatus } from "@/lib/schemas/tasks";
import { cn } from "@/lib/utils";

const EST_QUICK_PICKS = [15, 30, 60, 120, 240] as const;

type TaskFieldsLayout = "inline" | "stacked";

type TaskFieldsProps = {
  form: TaskFormController;
  categories: TaskCategoryRow[];
  onCreateCategory: (input: { name: string; color?: string }) => Promise<TaskCategoryRow>;
  layout?: TaskFieldsLayout;
};

function FieldLabel({ children }: { children: string }) {
  return <span className="text-xs text-muted-foreground">{children}</span>;
}

export function TaskFields({ form, categories, onCreateCategory, layout = "stacked" }: TaskFieldsProps) {
  const threeCol = layout === "inline" ? "grid gap-3 md:grid-cols-3" : "flex flex-col gap-3";
  const twoCol = layout === "inline" ? "grid gap-3 md:grid-cols-2" : "flex flex-col gap-3";

  return (
    <div className="flex flex-col gap-3">
      <Textarea
        placeholder="Description"
        rows={layout === "inline" ? 2 : 4}
        value={form.notes}
        onChange={(event) => form.setNotes(event.target.value)}
      />

      <div className={threeCol}>
        <CategoryPicker
          categories={categories}
          value={form.categoryId}
          onChange={form.setCategoryId}
          onCreateCategory={onCreateCategory}
        />

        <Select value={form.priority} onValueChange={form.setPriority}>
          <SelectTrigger>
            <SelectValue placeholder="Priority" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">No priority</SelectItem>
            {TaskPriority.options.map((option) => (
              <SelectItem key={option} value={option}>
                {option}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={form.status}
          onValueChange={(value) => form.setStatus(value as TaskFormController["status"])}
        >
          <SelectTrigger>
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            {TaskStatus.options.map((option) => (
              <SelectItem key={option} value={option}>
                {formatTaskStatus(option)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className={twoCol}>
        <div className="space-y-2">
          <FieldLabel>Planned</FieldLabel>
          <Input
            type={form.plannedHasTime ? "datetime-local" : "date"}
            value={form.plannedValue}
            onChange={(event) => form.setPlannedValue(event.target.value)}
          />
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Switch checked={form.plannedHasTime} onCheckedChange={form.setPlannedHasTime} />
            Include time
          </div>
        </div>

        <div className="space-y-2">
          <FieldLabel>Due date</FieldLabel>
          <Input
            type="date"
            value={form.dueDate}
            onChange={(event) => form.setDueDate(event.target.value)}
          />
        </div>
      </div>

      <div className={twoCol}>
        <div className="space-y-2">
          <FieldLabel>Duration</FieldLabel>
          <div className="flex flex-wrap items-center gap-1.5">
            {EST_QUICK_PICKS.map((minutes) => (
              <Button
                key={minutes}
                size="sm"
                type="button"
                variant={form.estMinutes === minutes ? "default" : "outline"}
                onClick={() => form.setEstMinutes(minutes)}
              >
                {minutes}m
              </Button>
            ))}
            <Input
              className="w-20"
              min={1}
              placeholder="Custom"
              type="number"
              value={form.estMinutes ?? ""}
              onChange={(event) =>
                form.setEstMinutes(event.target.value ? Number(event.target.value) : null)
              }
            />
          </div>
        </div>

        <div className={cn("space-y-2", layout === "inline" && "md:self-start")}>
          <FieldLabel>Mental effort</FieldLabel>
          <Select value={form.mentalEffort} onValueChange={form.setMentalEffort}>
            <SelectTrigger>
              <SelectValue placeholder="Mental effort" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No effort set</SelectItem>
              {MentalEffort.options.map((option) => (
                <SelectItem key={option} value={option}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}
