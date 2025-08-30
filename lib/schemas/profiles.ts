import z from "zod";

export const ProfileSchema = z.object({
  clerk_user_id: z.string().min(1),
  display_name: z.string().min(1).max(255).optional(),
  email: z.email().optional(),
});

export const ProfileCreate = ProfileSchema;

export const ProfileUpdate = ProfileCreate.partial();

export type Profile = z.infer<typeof ProfileSchema>;
export type ProfileInsert = z.infer<typeof ProfileCreate>;
export type ProfilePatch = z.infer<typeof ProfileUpdate>;
