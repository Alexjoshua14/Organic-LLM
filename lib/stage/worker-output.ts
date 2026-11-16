import { z } from "zod";

import { invalidUpsertReason } from "./reconcile";

// Flat fields keep the provider schema compatible with strict structured output.
export const StageWorkerPieceSchema = z
  .object({
    kind: z.enum(["note", "mermaid", "recipe", "block", "web"]),
    title: z.string().min(1).max(100),
    text: z.string().max(4000).nullable(),
    code: z.string().max(8000).nullable(),
    ingredients: z.array(z.string().max(200)).max(40).nullable(),
    steps: z.array(z.string().max(1000)).max(30).nullable(),
    block: z.string().max(12000).nullable(),
    url: z.string().max(2000).nullable(),
  })
  .refine(
    (piece) => !invalidUpsertReason(piece),
    "A Stage piece needs content for its kind"
  );
export const StageWorkerOutputSchema = z.object({
  reply: z.string().min(1).max(6000),
  pieces: z.array(StageWorkerPieceSchema).max(2),
});
export type StageWorkerPiece = z.infer<typeof StageWorkerPieceSchema>;
