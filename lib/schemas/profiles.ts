import z from "zod";

import { ProfileTreeSchema, ProfileTreeSourceSchema } from "@/lib/schemas/profileTree";

export const ProfileSchema = z.object({
  clerk_user_id: z.string().min(1),
  display_name: z.string().min(1).max(255).nullable().optional(),
  email: z.email().nullable().optional(),
  profile_tree: ProfileTreeSchema.nullable().optional(),
  profile_tree_updated_at: z.string().datetime().nullable().optional(),
  profile_tree_source: ProfileTreeSourceSchema.nullable().optional(),
  /** Admin flag: when true, user sees sandbox gateway etc. Column is admin-only in Supabase. */
  admin: z.boolean().optional(),
});

export const ProfileCreate = ProfileSchema;

export const ProfileUpdate = ProfileCreate.partial();

export type Profile = z.infer<typeof ProfileSchema>;
export type ProfileInsert = z.infer<typeof ProfileCreate>;
export type ProfilePatch = z.infer<typeof ProfileUpdate>;
