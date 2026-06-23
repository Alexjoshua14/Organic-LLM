"use client";

import type { ErgonTaskRowKeyboardProps } from "@/lib/ergon/use-ergon-task-list-keyboard";
import type { TaskWithCategory } from "@/lib/ergon/types";

import { TaskRow } from "@/components/ergon/TaskRow";
import { formatCompletedDate } from "@/lib/ergon/format";
import { sortDoneTasks } from "@/lib/ergon/task-view";

type DoneViewProps = {
  tasks: TaskWithCategory[];
  onToggleComplete: (id: string) => void | Promise<void>;
  onToggleActive: (id: string) => void | Promise<void>;
  onEdit: (task: TaskWithCategory) => void;
  onDelete: (id: string) => void | Promise<void>;
  onChatAbout?: (task: TaskWithCategory) => void;
  getTaskRowProps?: (taskId: string) => ErgonTaskRowKeyboardProps;
};

export function DoneView({
  tasks,
  onToggleComplete,
  onToggleActive,
  onEdit,
  onDelete,
  onChatAbout,
  getTaskRowProps,
}: DoneViewProps) {
  const sorted = sortDoneTasks(tasks);

  return (
    <div aria-label="Completed tasks" className="space-y-2" role="list">
      {sorted.map((task) => (
        <div key={task.id} className="space-y-1">
          {task.completed_at ? (
            <p className="px-1 text-[11px] text-muted-foreground">
              Completed {formatCompletedDate(task.completed_at)}
            </p>
          ) : null}
          <TaskRow
            keyboardProps={getTaskRowProps?.(task.id)}
            task={task}
            onChatAbout={onChatAbout}
            onDelete={onDelete}
            onEdit={onEdit}
            onToggleActive={onToggleActive}
            onToggleComplete={onToggleComplete}
          />
        </div>
      ))}
    </div>
  );
}
