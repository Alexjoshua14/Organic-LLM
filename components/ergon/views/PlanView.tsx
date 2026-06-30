"use client";

import type { ErgonTaskRowKeyboardProps } from "@/lib/ergon/use-ergon-task-list-keyboard";
import type { TaskWithCategory } from "@/lib/ergon/types";

import { TaskRow } from "@/components/ergon/TaskRow";
import { ERGON_VIEW_SECTION_HEADER, ERGON_VIEW_TOOLBAR_ROW } from "@/components/ergon/ergon-view-layout";
import { formatCapacityMinutes } from "@/lib/ergon/format";
import {
  PLAN_BUCKET_LABELS,
  PLAN_BUCKET_ORDER,
  groupTasksByPlanBucket,
  sumEstMinutes,
} from "@/lib/ergon/plan-buckets";
import { cn } from "@/lib/utils";

type PlanViewProps = {
  tasks: TaskWithCategory[];
  onToggleComplete: (id: string) => void | Promise<void>;
  onToggleActive: (id: string) => void | Promise<void>;
  onEdit: (task: TaskWithCategory) => void;
  onDelete: (id: string) => void | Promise<void>;
  onEnhance?: (id: string) => void | Promise<void>;
  onChatAbout?: (task: TaskWithCategory) => void;
  getTaskRowProps?: (taskId: string) => ErgonTaskRowKeyboardProps;
};

export function PlanView({
  tasks,
  onToggleComplete,
  onToggleActive,
  onEdit,
  onDelete,
  onEnhance,
  onChatAbout,
  getTaskRowProps,
}: PlanViewProps) {
  const buckets = groupTasksByPlanBucket(tasks);
  let isFirstSection = true;

  return (
    <div className="space-y-4 md:space-y-6">
      <div aria-hidden className={ERGON_VIEW_TOOLBAR_ROW} />

      {PLAN_BUCKET_ORDER.map((bucketId) => {
        const bucketTasks = buckets[bucketId];

        if (bucketTasks.length === 0) return null;

        const capacity = sumEstMinutes(bucketTasks);
        const labeled = bucketId !== "unscheduled";
        const bucketLabel = labeled ? PLAN_BUCKET_LABELS[bucketId] : undefined;
        const reserveHeader = labeled || isFirstSection;

        isFirstSection = false;

        return (
          <section key={bucketId} className="space-y-2">
            {reserveHeader ? (
              <div
                className={cn(
                  ERGON_VIEW_SECTION_HEADER,
                  labeled && "flex items-baseline justify-between gap-3"
                )}
              >
                {labeled ? (
                  <>
                    <h3 className="font-commissioner text-sm font-light tracking-wide text-foreground">
                      {bucketLabel}
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      {bucketTasks.length} · {formatCapacityMinutes(capacity)}
                    </p>
                  </>
                ) : null}
              </div>
            ) : null}
            <div aria-label={bucketLabel} className="space-y-2" role="list">
              {bucketTasks.map((task) => (
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
        );
      })}
    </div>
  );
}
