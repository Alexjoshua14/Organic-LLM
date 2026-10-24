import { z } from "zod";

import { PrepIsoDate } from "./shared";

/** One meal-prep week. `weekStart` must be a Monday (ISO date). */
export const PrepWeekSchema = z.object({
  id: z.string().uuid(),
  weekStart: PrepIsoDate,
});

export type PrepWeek = z.infer<typeof PrepWeekSchema>;
