"use server";

import type { TaskInsert } from "@/lib/schemas/tasks";

import { auth } from "@clerk/nextjs/server";

import { getSupabaseUserId } from "@/data/supabase/profiles";
import { needsLlmRefinement, refineTasksLocally } from "@/lib/ergon/refine-task-capture-local";
import { refineTasksWithLlm } from "@/lib/ergon/refine-task-capture-llm";
import { mergeRefinedTaskCaptures } from "@/lib/ergon/refine-task-capture-merge";
import { ErgonRefineRequestSchema } from "@/lib/schemas/ergon-refine";
import { checkLlmMessageLimit } from "@/lib/rate-limit/llm";

/**
 * Optional LLM pass for quick-add: ZDR nano model when titles contain extractable signals.
 * Always falls back to local sentence-case cleanup on timeout, rate limit, or error.
 */
export async function actionRefineQuickAddTasks(raw: unknown): Promise<TaskInsert[]> {
  const { userId } = await auth();

  if (!userId) {
    throw new Error("Unauthorized");
  }

  const parsed = ErgonRefineRequestSchema.parse(raw);
  const { titles, categories, nowIso } = parsed;
  const local = refineTasksLocally(titles);

  if (!needsLlmRefinement(titles)) {
    return local;
  }

  const sbUserResult = await getSupabaseUserId(userId);

  if (sbUserResult.error || sbUserResult.data === null) {
    return local;
  }

  const limit = await checkLlmMessageLimit(sbUserResult.data);

  if (!limit.success) {
    return local;
  }

  const llmResult = await refineTasksWithLlm({
    titles,
    categories,
    now: nowIso ? new Date(nowIso) : new Date(),
  });

  if (llmResult.error || !llmResult.data) {
    return local;
  }

  return mergeRefinedTaskCaptures(titles, llmResult.data, categories);
}
