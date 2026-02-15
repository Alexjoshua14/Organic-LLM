/**
 * Tiered profile content: sections and subsections for generative/programmatic rendering.
 * LLM can return this shape; we also define static trees for tailored, demo, and empty states.
 */
import { z } from "zod";

export type ProfileSection = {
  id: string;
  title: string;
  body?: string;
  items?: string[];
  children?: ProfileSection[];
};

export const ProfileSectionSchema: z.ZodType<ProfileSection> = z.object({
  id: z.string(),
  title: z.string(),
  body: z.string().optional(),
  items: z.array(z.string()).optional(),
  children: z.lazy(() => z.array(ProfileSectionSchema)).optional(),
});

export const ProfileTreeSchema = z.object({
  headline: z.string(),
  /** Identity roles shown as premium badges (e.g. Software engineer, Creative technologist). */
  roles: z.array(z.string()).optional(),
  /** One high-level affiliation/signature line, rendered as a distinct block. */
  signature: z.string().optional(),
  sections: z.array(ProfileSectionSchema),
});
export type ProfileTree = z.infer<typeof ProfileTreeSchema>;
