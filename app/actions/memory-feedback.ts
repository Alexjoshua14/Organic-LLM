"use server";

import { recordMemoryFeedbackForCurrentUser } from "@/lib/memory/feedback";
import type { RecordMemoryFeedbackInput } from "@/lib/schemas/memory-quality";
import { Result } from "@/types";

export async function actionRecordMemoryFeedback(
  input: RecordMemoryFeedbackInput
): Promise<Result<boolean, string>> {
  return recordMemoryFeedbackForCurrentUser(input);
}
