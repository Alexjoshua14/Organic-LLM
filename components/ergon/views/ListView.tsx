"use client";

import type { ErgonTaskRowKeyboardProps } from "@/lib/ergon/use-ergon-task-list-keyboard";
import type { ListSort, TaskCategoryRow, TaskWithCategory } from "@/lib/ergon/types";

import { TaskRow } from "@/components/ergon/TaskRow";
import { Button } from "@/components/third-party/ui/button";
import { groupTasksByCategory, sortTasksBy } from "@/lib/ergon/task-view";
import { cn } from "@/lib/utils";

type ListViewProps = {
  tasks: TaskWithCategory[];
  categories: TaskCategoryRow[];
  sort: ListSort;
  onSortChange: (sort: ListSort) => void;
  onToggleComplete: (id: string) => void | Promise<void>;
  onToggleActive: (id: string) => void | Promise<void>;
  onEdit: (task: TaskWithCategory) => void;
  onDelete: (id: string) => void | Promise<void>;
  onEnhance?: (id: string) => void | Promise<void>;
  onChatAbout?: (task: TaskWithCategory) => void;
  getTaskRowProps?: (taskId: string) => ErgonTaskRowKeyboardProps;
};

export function ListView({
  tasks,
  categories,
  sort,
  onSortChange,
  onToggleComplete,
  onToggleActive,
  onEdit,
  onDelete,
  onEnhance,
  onChatAbout,
  getTaskRowProps,
}: ListViewProps) {
  const groups = groupTasksByCategory(sortTasksBy(tasks, sort), categories);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <span className="text-xs uppercase tracking-[0.16em] text-muted-foreground/70">Sort</span>
        <Button
          size="sm"
          type="button"
          variant={sort === "priority" ? "default" : "outline"}
          onClick={() => onSortChange("priority")}
        >
          Priority
        </Button>
        <Button
          size="sm"
          type="button"
          variant={sort === "due" ? "default" : "outline"}
          onClick={() => onSortChange("due")}
        >
          Due
        </Button>
      </div>

      {groups.map((group) => (
        <section key={group.categoryId ?? "uncategorized"} className="space-y-2">
          <div className="flex items-center gap-2">
            {group.color ? (
              <span
                aria-hidden
                className="size-2.5 rounded-full"
                style={{ backgroundColor: group.color }}
              />
            ) : null}
            <h3
              className={cn(
                "font-commissioner text-sm font-light tracking-wide",
                group.color ? "text-foreground" : "text-muted-foreground"
              )}
            >
              {group.label}
            </h3>
            <span className="text-xs text-muted-foreground">{group.tasks.length}</span>
          </div>
          <div aria-label={group.label} className="space-y-2" role="list">
            {group.tasks.map((task) => (
              <TaskRow
                key={task.id}
                keyboardProps={getTaskRowProps?.(task.id)}
                task={task}
                onChatAbout={onChatAbout}
                onDelete={onDelete}
                onEdit={onEdit}
                onEnhance={onEnhance}
                onToggleActive={onToggleActive}
                onToggleComplete={onToggleComplete}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
