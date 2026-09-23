"use server";

import type { RecordMemoryFeedbackInput } from "@/lib/schemas/memory-quality";

import { recordMemoryFeedbackForCurrentUser } from "@/lib/memory/feedback";
import { Result } from "@/types";

export async function actionRecordMemoryFeedback(
  input: RecordMemoryFeedbackInput
): Promise<Result<boolean, string>> {
  return recordMemoryFeedbackForCurrentUser(input);
}
