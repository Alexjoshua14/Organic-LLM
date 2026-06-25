import { z } from "zod";

import { MISE_CAPS, MiseClientId } from "./shared";

import { PlanTimelineStepSchema } from "@/lib/schemas/gen-ui";

/**
 * An event being cooked for (housewarming, dinner party, …). The prep schedule is
 * stored as `timeline` — an array of the existing gen-UI plan-timeline steps, so the
 * "what to make and when" checklist is durable and renders with the same component.
 */
export const MiseEventSchema = z.object({
  id: MiseClientId.optional(),
  title: z.string().min(1).max(MISE_CAPS.eventTitle),
  /** ISO date (YYYY-MM-DD) when known. */
  date: z.iso.date().optional(),
  /** Free-form time, e.g. "7:30 PM". */
  time: z.string().max(40).optional(),
  location: z.string().max(MISE_CAPS.location).optional(),
  guestCount: z.number().int().min(1).max(10_000).optional(),
  notes: z.string().max(MISE_CAPS.notes).optional(),
  timeline: z.array(PlanTimelineStepSchema).max(MISE_CAPS.timelineSteps).optional(),
});

export type MiseEvent = z.infer<typeof MiseEventSchema>;

export const MiseEventPatchSchema = MiseEventSchema.partial();
export type MiseEventPatch = z.infer<typeof MiseEventPatchSchema>;
