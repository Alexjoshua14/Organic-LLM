import z from "zod";

export const AlignmentSchema = z.object({
  characters: z.array(z.string()),
  characterStartTimesSeconds: z.array(z.number()),
  characterEndTimesSeconds: z.array(z.number()),
});

export const AudioStreamChunkSchema = z.object({
  audioBase64: z.string(),
  alignment: AlignmentSchema.optional(),
  normalizedAlignment: AlignmentSchema.optional(),
});

export type AlignmentData = {
  characters: string[];
  characterStartTimesSeconds: number[];
  characterEndTimesSeconds: number[];
};
