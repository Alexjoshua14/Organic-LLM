"use client";

import Link from "next/link";
import { ArrowUpRight, CheckCircle2, ListTodo, Pencil, Plus, TriangleAlert } from "lucide-react";

import { glass } from "@/components/design-system/primitives";
import { formatDueDate, formatEstMinutes, formatPlannedDate } from "@/lib/ergon/format";
import { type ErgonTaskSummary, ErgonTasksToolOutputSchema } from "@/lib/schemas/ergon-tasks";
import { cn } from "@/lib/utils";

const MAX_VISIBLE_TASKS = 6;

const ACTION_LABELS: Record<string, string> = {
  created: "Added to Ergon",
  updated: "Task updated",
  completed: "Task completed",
  listed: "Your tasks",
  error: "Couldn't update tasks",
};

function actionIcon(action: string) {
  if (action === "created") return <Plus className="size-3.5" />;
  if (action === "updated") return <Pencil className="size-3.5" />;
  if (action === "completed") return <CheckCircle2 className="size-3.5" />;
  if (action === "error") return <TriangleAlert className="size-3.5" />;

  return <ListTodo className="size-3.5" />;
}

function TaskLine({ task }: { task: ErgonTaskSummary }) {
  const planned = formatPlannedDate(task.planned_at, false);
  const due = formatDueDate(task.due_date);
  const isDone = task.status === "done" || task.status === "archived";

  return (
    <li className="flex items-center gap-2 px-3 py-1.5 text-sm">
      <span
        className={cn(
          "size-1.5 shrink-0 rounded-full",
          task.is_active ? "bg-lumen" : isDone ? "bg-emerald-500" : "bg-muted-foreground/40"
        )}
      />
      <span
        className={cn(
          "min-w-0 flex-1 truncate text-foreground",
          isDone && "text-muted-foreground line-through"
        )}
      >
        {task.title}
      </span>
      <span className="flex shrink-0 items-center gap-1.5 text-[11px] text-muted-foreground">
        {task.category_name ? <span>{task.category_name}</span> : null}
        {planned ? <span>{planned}</span> : null}
        {due ? <span>{due}</span> : null}
        {task.priority ? <span className="capitalize">{task.priority}</span> : null}
      </span>
    </li>
  );
}

export function ErgonTaskResult({ output }: { output: unknown }) {
  const parsed = ErgonTasksToolOutputSchema.safeParse(output);

  if (!parsed.success) return null;

  const { action, tasks, error } = parsed.data;
  const label = ACTION_LABELS[action] ?? "Ergon";

  if (action === "error" || (error && tasks.length === 0)) {
    return (
      <div className="not-prose inline-flex items-center gap-1.5 rounded-full border border-border/50 bg-background-tertiary/40 px-2.5 py-1 text-xs text-muted-foreground">
        <TriangleAlert className="size-3" />
        {error ?? "Couldn't update tasks"}
      </div>
    );
  }

  if (tasks.length === 0) {
    return (
      <div className="not-prose inline-flex items-center gap-1.5 rounded-full border border-border/50 bg-background-tertiary/40 px-2.5 py-1 text-xs text-muted-foreground">
        <ListTodo className="size-3" />
        No matching tasks
      </div>
    );
  }

  const visible = tasks.slice(0, MAX_VISIBLE_TASKS);
  const remaining = tasks.length - visible.length;

  return (
    <div
      className={cn(
        "not-prose w-full max-w-md overflow-hidden rounded-xl border border-border/50",
        glass({ opaque: true })
      )}
    >
      <div className="flex items-center justify-between gap-2 border-b border-border/40 px-3 py-2">
        <span className="flex items-center gap-1.5 text-xs font-medium text-foreground">
          {actionIcon(action)}
          {label}
          <span className="text-muted-foreground">· {tasks.length}</span>
        </span>
        <Link
          className="flex items-center gap-0.5 text-[11px] text-muted-foreground transition-colors hover:text-foreground"
          href="/ergon"
        >
          Open Ergon
          <ArrowUpRight className="size-3" />
        </Link>
      </div>
      <ul className="divide-y divide-border/30">
        {visible.map((task) => (
          <TaskLine key={task.id} task={task} />
        ))}
      </ul>
      {remaining > 0 ? (
        <Link
          className="block px-3 py-1.5 text-[11px] text-muted-foreground transition-colors hover:text-foreground"
          href="/ergon"
        >
          +{remaining} more on Ergon
        </Link>
      ) : null}
    </div>
  );
}
