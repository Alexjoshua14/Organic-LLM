import { z } from "zod";

// Flat fields keep the provider schema compatible with strict structured output.
export const StageWorkerPieceSchema = z
  .object({
    kind: z.enum(["note", "mermaid", "recipe"]),
    title: z.string().min(1).max(100),
    text: z.string().max(4000).nullable(),
    code: z.string().max(8000).nullable(),
    ingredients: z.array(z.string().max(200)).max(40).nullable(),
    steps: z.array(z.string().max(1000)).max(30).nullable(),
  })
  .refine(
    (piece) =>
      piece.kind === "note"
        ? !!piece.text?.trim()
        : piece.kind === "mermaid"
          ? !!piece.code?.trim()
          : !!piece.ingredients?.length && !!piece.steps?.length,
    "A Stage piece needs content for its kind"
  );
export const StageWorkerOutputSchema = z.object({
  reply: z.string().min(1).max(6000),
  pieces: z.array(StageWorkerPieceSchema).max(2),
});
export type StageWorkerPiece = z.infer<typeof StageWorkerPieceSchema>;
