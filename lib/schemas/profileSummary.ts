import { z } from "zod";

/**
 * LLM-generated profile summary for the profile view.
 * Cached in localStorage (and eventually synced to Supabase).
 */
export const ProfileSummarySchema = z.object({
  headline: z.string().max(120),
  bio: z.string().max(500),
  tags: z.array(z.string().max(32)).max(8),
  generatedAt: z.string().datetime(),
});

export type ProfileSummary = z.infer<typeof ProfileSummarySchema>;
