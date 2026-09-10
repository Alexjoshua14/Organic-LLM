import { z } from "zod";

import { PrepIsoDate, PrepSlotSchema } from "./shared";

/**
 * A week grid cell. Cook slots have `leftoverOfPlacementId` unset; leftover
 * slots point at a cook placement and still carry `recipeId` for glance fields.
 */
export const PrepPlacementSchema = z.object({
  id: z.string().uuid(),
  weekId: z.string().uuid(),
  date: PrepIsoDate,
  slot: PrepSlotSchema,
  recipeId: z.string().uuid(),
  leftoverOfPlacementId: z.string().uuid().optional(),
});

export type PrepPlacement = z.infer<typeof PrepPlacementSchema>;

export const PrepPlacementWriteSchema = z.object({
  weekId: z.string().uuid(),
  date: PrepIsoDate,
  slot: PrepSlotSchema,
  recipeId: z.string().uuid(),
  leftoverOfPlacementId: z.string().uuid().optional(),
});

export type PrepPlacementWrite = z.infer<typeof PrepPlacementWriteSchema>;
