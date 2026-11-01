import { z } from "zod";

export const StageViewSchema = z
  .object({
    kind: z.enum(["organic", "overview", "author", "piece"]),
    id: z.string().uuid().nullable(),
  })
  .strict();
export type StageView = z.infer<typeof StageViewSchema>;
export const ORGANIC_STAGE_VIEW: StageView = { kind: "organic", id: null };
export const STAGE_VIEW_EVENT = "organic-stage:view";
export const StageViewCommandSchema = z
  .object({ id: z.string().uuid(), target: StageViewSchema })
  .strict();

export const StagePresentationSchema = z
  .object({
    view: StageViewSchema,
    width: z.number().int().min(0).max(10000),
    height: z.number().int().min(0).max(10000),
    composerHeight: z.number().int().min(0).max(2000),
    // Accepted for older voice sessions; selection no longer pages or reflows grid pieces.
    page: z.number().int().min(0).max(48).optional(),
    reading: z.boolean().optional(),
  })
  .strict();
export type StagePresentation = z.infer<typeof StagePresentationSchema>;
