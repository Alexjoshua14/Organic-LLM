import type { TaskInsert } from "@/lib/schemas/tasks";
import type { ErgonRefineCategoryHintSchema, ErgonRefineLlmTask } from "@/lib/schemas/ergon-refine";

import z from "zod";

import {
  refineTasksLocally,
  sentenceCaseTitle,
  titleSupportsCategory,
  titleSupportsDueDate,
  titleSupportsEstMinutes,
  titleSupportsMentalEffort,
  titleSupportsPlannedDate,
  titleSupportsPriority,
} from "@/lib/ergon/refine-task-capture-local";
import { MentalEffort, TaskPriority } from "@/lib/schemas/tasks";

type CategoryHint = z.infer<typeof ErgonRefineCategoryHintSchema>;

function dateOnlyToPlannedAt(isoDate: string): string {
  return `${isoDate}T12:00:00.000Z`;
}

function resolveCategoryId(
  title: string,
  categoryName: string | null | undefined,
  categories: CategoryHint[]
): string | undefined {
  if (!categoryName?.trim()) return undefined;

  const normalized = categoryName.trim().toLowerCase();
  const match = categories.find((category) => category.name.trim().toLowerCase() === normalized);

  if (!match || !titleSupportsCategory(title, match.name)) {
    return undefined;
  }

  return match.id;
}

function mergeOneTask(
  originalTitle: string,
  llmTask: ErgonRefineLlmTask | undefined,
  categories: CategoryHint[]
): TaskInsert {
  const fallbackTitle = sentenceCaseTitle(originalTitle);
  const title =
    llmTask?.title && llmTask.title.trim().length >= 2
      ? sentenceCaseTitle(llmTask.title)
      : fallbackTitle;

  const draft: TaskInsert = { title, tags: [] };

  if (!llmTask) return draft;

  const categoryId = resolveCategoryId(originalTitle, llmTask.category_name, categories);

  if (categoryId) {
    draft.category_id = categoryId;
  }

  if (
    llmTask.priority &&
    TaskPriority.safeParse(llmTask.priority).success &&
    titleSupportsPriority(originalTitle)
  ) {
    draft.priority = llmTask.priority;
  }

  if (llmTask.due_date && titleSupportsDueDate(originalTitle)) {
    draft.due_date = llmTask.due_date;
  }

  if (llmTask.planned_date && titleSupportsPlannedDate(originalTitle)) {
    draft.planned_at = dateOnlyToPlannedAt(llmTask.planned_date);
    draft.planned_has_time = false;
  }

  if (
    llmTask.est_minutes != null &&
    llmTask.est_minutes >= 1 &&
    titleSupportsEstMinutes(originalTitle)
  ) {
    draft.est_minutes = llmTask.est_minutes;
  }

  if (
    llmTask.mental_effort &&
    MentalEffort.safeParse(llmTask.mental_effort).success &&
    titleSupportsMentalEffort(originalTitle)
  ) {
    draft.mental_effort = llmTask.mental_effort;
  }

  return draft;
}

/** Merge LLM drafts with originals; drop fields not supported by the source title. */
export function mergeRefinedTaskCaptures(
  originalTitles: string[],
  llmTasks: ErgonRefineLlmTask[] | null | undefined,
  categories: CategoryHint[]
): TaskInsert[] {
  const local = refineTasksLocally(originalTitles);

  if (!llmTasks?.length) return local;

  return originalTitles.map((originalTitle, index) =>
    mergeOneTask(originalTitle, llmTasks[index], categories)
  );
}
