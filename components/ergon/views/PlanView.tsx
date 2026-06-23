"use client";

import type { ErgonTaskRowKeyboardProps } from "@/lib/ergon/use-ergon-task-list-keyboard";
import type { TaskWithCategory } from "@/lib/ergon/types";

import { TaskRow } from "@/components/ergon/TaskRow";
import { formatCapacityMinutes } from "@/lib/ergon/format";
import {
  PLAN_BUCKET_LABELS,
  PLAN_BUCKET_ORDER,
  groupTasksByPlanBucket,
  sumEstMinutes,
} from "@/lib/ergon/plan-buckets";

type PlanViewProps = {
  tasks: TaskWithCategory[];
  onToggleComplete: (id: string) => void | Promise<void>;
  onToggleActive: (id: string) => void | Promise<void>;
  onEdit: (task: TaskWithCategory) => void;
  onDelete: (id: string) => void | Promise<void>;
  onChatAbout?: (task: TaskWithCategory) => void;
  getTaskRowProps?: (taskId: string) => ErgonTaskRowKeyboardProps;
};

export function PlanView({
  tasks,
  onToggleComplete,
  onToggleActive,
  onEdit,
  onDelete,
  onChatAbout,
  getTaskRowProps,
}: PlanViewProps) {
  const buckets = groupTasksByPlanBucket(tasks);

  return (
    <div className="space-y-4 md:space-y-6">
      {PLAN_BUCKET_ORDER.map((bucketId) => {
        const bucketTasks = buckets[bucketId];

        if (bucketTasks.length === 0) return null;

        const capacity = sumEstMinutes(bucketTasks);

        return (
          <section key={bucketId} className="space-y-2">
            <div className="flex items-baseline justify-between gap-3">
              <h3 className="font-commissioner text-sm font-light tracking-wide text-foreground">
                {PLAN_BUCKET_LABELS[bucketId]}
              </h3>
              <p className="text-xs text-muted-foreground">
                {bucketTasks.length} · {formatCapacityMinutes(capacity)}
              </p>
            </div>
            <div aria-label={PLAN_BUCKET_LABELS[bucketId]} className="space-y-2" role="list">
              {bucketTasks.map((task) => (
                <TaskRow
                  key={task.id}
                  keyboardProps={getTaskRowProps?.(task.id)}
                  task={task}
                  onChatAbout={onChatAbout}
                  onDelete={onDelete}
                  onEdit={onEdit}
                  onToggleActive={onToggleActive}
                  onToggleComplete={onToggleComplete}
                />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
