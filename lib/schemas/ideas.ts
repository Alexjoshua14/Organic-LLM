import z from "zod";

export const IdeaStatus = z.enum(["active", "archived"]);

export const IdeaCreate = z.object({
  title: z.string().min(2).max(255),
  notes: z.string().max(10_000).optional(),
  summary: z.string().max(1_000).optional(),
  tags: z.array(z.string().min(1).max(24)).max(6).default([]),
  priority: z.number().int().min(1).max(3).default(2),
  status: IdeaStatus.default("active"),
});

export const IdeaUpdate = IdeaCreate.partial();

export type IdeaInsert = z.infer<typeof IdeaCreate>;
export type IdeaPatch = z.infer<typeof IdeaUpdate>;
