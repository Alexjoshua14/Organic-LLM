import { z } from "zod";

export const RESEARCH_REUSE_LIMIT = 80;
export const ResearchAnnotationSchema = z.object({
  synopsis: z.string().max(1_200),
  takeaways: z.array(z.string().max(500)).max(5),
});
export const ResearchReuseEntrySchema = z.object({
  key: z.string().regex(/^[a-f0-9]{64}$/),
  kind: z.enum(["search", "read", "annotation"]),
  sourceIds: z.array(z.string()).min(1).max(10),
  approvalDigest: z.string().regex(/^[a-f0-9]{64}$/),
  createdAt: z.string().datetime(),
  expiresAt: z.string().datetime(),
  annotation: ResearchAnnotationSchema.optional(),
});
export type ResearchReuseEntry = z.infer<typeof ResearchReuseEntrySchema>;
