import type { TaskWithCategory } from "@/lib/ergon/types";

export type PlanBucketId = "today" | "tomorrow" | "this_week" | "later" | "unscheduled";

export const PLAN_BUCKET_LABELS: Record<Exclude<PlanBucketId, "unscheduled">, string> = {
  today: "Today",
  tomorrow: "Tomorrow",
  this_week: "This week",
  later: "Later",
};

export const PLAN_BUCKET_ORDER: PlanBucketId[] = [
  "today",
  "tomorrow",
  "this_week",
  "later",
  "unscheduled",
];

function startOfLocalDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

function endOfLocalWeek(d: Date): number {
  const day = d.getDay();
  const daysUntilSunday = day === 0 ? 0 : 7 - day;
  const end = new Date(d.getFullYear(), d.getMonth(), d.getDate() + daysUntilSunday);

  return startOfLocalDay(end);
}

export function getPlanBucket(plannedAt: string | null, now = new Date()): PlanBucketId {
  if (!plannedAt) return "unscheduled";

  const plannedDay = startOfLocalDay(new Date(plannedAt));
  const today = startOfLocalDay(now);
  const tomorrow = today + 86400000;
  const dayAfterTomorrow = tomorrow + 86400000;
  const weekEnd = endOfLocalWeek(now);

  if (plannedDay < today) return "today";
  if (plannedDay === today) return "today";
  if (plannedDay === tomorrow) return "tomorrow";
  if (plannedDay >= dayAfterTomorrow && plannedDay <= weekEnd) return "this_week";

  return "later";
}

export function groupTasksByPlanBucket(
  tasks: TaskWithCategory[],
  now = new Date()
): Record<PlanBucketId, TaskWithCategory[]> {
  const buckets = Object.fromEntries(
    PLAN_BUCKET_ORDER.map((id) => [id, [] as TaskWithCategory[]])
  ) as Record<PlanBucketId, TaskWithCategory[]>;

  for (const task of tasks) {
    buckets[getPlanBucket(task.planned_at, now)].push(task);
  }

  return buckets;
}

export function sumEstMinutes(tasks: Pick<TaskWithCategory, "est_minutes">[]): number {
  return tasks.reduce((sum, task) => sum + (task.est_minutes ?? 0), 0);
}
