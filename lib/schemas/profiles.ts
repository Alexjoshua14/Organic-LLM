import z from "zod";

export const ProfileCreate = z.object({
  clerk_user_id: z.string().min(1),
  display_name: z.string().min(1).max(255).optional(),
  email: z.email().optional(),
});

export const ProfileUpdate = ProfileCreate.partial();

export type ProfileInsert = z.infer<typeof ProfileCreate>;
export type ProfilePatch = z.infer<typeof ProfileUpdate>;
