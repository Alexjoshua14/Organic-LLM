import { after } from "next/server";

import { runArcadiaContextCondensation } from "@/lib/api/run-arcadia-context-condensation";
import { createLogger } from "@/lib/logger";

const logger = createLogger("lib/api/schedule-arcadia-context-condensation.ts");

export type ScheduleArcadiaContextCondensationParams = {
  chatId: string;
  modelId: string;
};

/**
 * Schedules Arcadia context condensation after the response is sent (Next.js `after()`).
 * The current turn proceeds immediately with the token-selected window + existing summary.
 */
export function scheduleArcadiaContextCondensation(
  params: ScheduleArcadiaContextCondensationParams
): void {
  const { chatId, modelId } = params;

  logger.log("scheduleArcadiaContextCondensation", "Queueing background condensation", {
    chatId,
    modelId,
  });

  after(async () => {
    await runArcadiaContextCondensation({ chatId, modelId });
  });
}
