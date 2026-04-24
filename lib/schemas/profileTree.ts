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

const ProfileSectionBaseSchema = z.object({
  id: z.string().min(1).max(64),
  title: z.string().min(1).max(80),
  body: z.string().max(1200).optional(),
  items: z.array(z.string().min(1).max(120)).max(12).optional(),
});

export const ProfileSectionSchema: z.ZodType<ProfileSection> = ProfileSectionBaseSchema.extend({
  children: z.lazy(() => z.array(ProfileSectionSchema).max(6)).optional(),
});

export const ProfileTreeSchema = z.object({
  headline: z.string().min(1).max(120),
  /** Identity roles shown as premium badges (e.g. Software engineer, Creative technologist). */
  roles: z.array(z.string().min(1).max(32)).max(6).optional(),
  /** One high-level affiliation/signature line, rendered as a distinct block. */
  signature: z.string().max(160).optional(),
  sections: z.array(ProfileSectionSchema).min(1).max(8),
});
export type ProfileTree = z.infer<typeof ProfileTreeSchema>;

export const ProfileTreeSourceSchema = z.enum(["tailored-seed", "llm-generated", "user-edited"]);
export type ProfileTreeSource = z.infer<typeof ProfileTreeSourceSchema>;
