import fs from "fs";
import path from "path";

import {
  EXPERIENCE_SURFACES,
  type ExperienceSurface,
  getExperienceSurfaceBySlug,
} from "@/lib/onboarding/experience-surfaces";

const SURFACES_CONTENT_DIR = path.join(process.cwd(), "content/blog/surfaces");

export function getAllSurfaceBlogSlugs(): string[] {
  return EXPERIENCE_SURFACES.map((s) => s.slug);
}

export function getSurfaceBlogMeta(slug: string): ExperienceSurface | undefined {
  return getExperienceSurfaceBySlug(slug);
}

export function getSurfaceBlogMarkdown(slug: string): string {
  const filePath = path.join(SURFACES_CONTENT_DIR, `${slug}.md`);

  try {
    return fs.readFileSync(filePath, "utf-8");
  } catch {
    const meta = getSurfaceBlogMeta(slug);

    return meta
      ? `# ${meta.label}\n\n${meta.description}\n\n_Documentation is being written._`
      : "# Surface not found";
  }
}
