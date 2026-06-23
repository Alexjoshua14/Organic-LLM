import z from "zod";

export const CategoryCreate = z.object({
  name: z.string().min(1).max(64).trim(),
  color: z.string().max(32).optional(),
  icon: z.string().max(64).optional(),
  sort_order: z.number().int().min(0).default(0),
});

export const CategoryUpdate = CategoryCreate.partial();

export type CategoryInsert = z.input<typeof CategoryCreate>;
export type CategoryPatch = z.infer<typeof CategoryUpdate>;
