import type { ListSort, TaskCategoryRow, TaskWithCategory } from "@/lib/ergon/types";

import { PLAN_BUCKET_ORDER, groupTasksByPlanBucket } from "@/lib/ergon/plan-buckets";
import { groupTasksByCategory, sortDoneTasks, sortTasksBy } from "@/lib/ergon/task-view";

/** Task ids in Plan view visual order (bucket order, stable within bucket). */
export function flattenPlanViewTaskIds(tasks: TaskWithCategory[]): string[] {
  const buckets = groupTasksByPlanBucket(tasks);

  return PLAN_BUCKET_ORDER.flatMap((bucketId) => buckets[bucketId].map((task) => task.id));
}

/** Task ids in List view visual order (category groups, given sort). */
export function flattenListViewTaskIds(
  tasks: TaskWithCategory[],
  categories: TaskCategoryRow[],
  sort: ListSort = "priority"
): string[] {
  const groups = groupTasksByCategory(sortTasksBy(tasks, sort), categories);

  return groups.flatMap((group) => group.tasks.map((task) => task.id));
}

/** Task ids in Done view visual order (most recently completed first). */
export function flattenDoneViewTaskIds(tasks: TaskWithCategory[]): string[] {
  return sortDoneTasks(tasks).map((task) => task.id);
}
