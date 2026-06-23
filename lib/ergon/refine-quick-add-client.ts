import type { TaskCategoryRow } from "@/lib/ergon/types";
import type { TaskInsert } from "@/lib/schemas/tasks";

import { actionRefineQuickAddTasks } from "@/app/actions/ergon-refine";
import { needsLlmRefinement, refineTasksLocally } from "@/lib/ergon/refine-task-capture-local";

const DEFAULT_LLM_TIMEOUT_MS = 1_800;

/**
 * Refine quick-add captures: instant local cleanup, optional ZDR LLM when titles carry metadata signals.
 */
export async function refineQuickAddCaptures(
  titles: string[],
  categories: Pick<TaskCategoryRow, "id" | "name">[],
  options?: { llmTimeoutMs?: number }
): Promise<TaskInsert[]> {
  const local = refineTasksLocally(titles);

  if (!needsLlmRefinement(titles)) {
    return local;
  }

  const timeoutMs = options?.llmTimeoutMs ?? DEFAULT_LLM_TIMEOUT_MS;

  try {
    const result = await Promise.race([
      actionRefineQuickAddTasks({
        titles,
        categories: categories.map((category) => ({ id: category.id, name: category.name })),
        nowIso: new Date().toISOString(),
      }),
      new Promise<null>((resolve) => {
        setTimeout(() => resolve(null), timeoutMs);
      }),
    ]);

    return result ?? local;
  } catch {
    return local;
  }
}
