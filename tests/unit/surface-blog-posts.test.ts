import { describe, expect, test } from "bun:test";
import fs from "fs";
import path from "path";

import { getAllSurfaceBlogSlugs, getSurfaceBlogMarkdown } from "@/lib/blog/surface-posts";
import {
  chatVariantSurfaces,
  EXPERIENCE_SURFACES,
  getExperienceSurfaceBySlug,
} from "@/lib/onboarding/experience-surfaces";

describe("surface blog posts", () => {
  test("every surface has a slug and markdown file", () => {
    const slugs = getAllSurfaceBlogSlugs();

    expect(slugs).toEqual(EXPERIENCE_SURFACES.map((s) => s.slug));

    for (const slug of slugs) {
      const filePath = path.join(process.cwd(), "content/blog/surfaces", `${slug}.md`);
      expect(fs.existsSync(filePath)).toBe(true);

      const content = getSurfaceBlogMarkdown(slug);
      expect(content.length).toBeGreaterThan(50);
      expect(content).not.toContain("Documentation is being written");
    }
  });

  test("chat variants are grouped under chat umbrella", () => {
    const variants = chatVariantSurfaces();

    expect(variants.map((v) => v.id)).toEqual(["arcadia", "noesis"]);

    for (const variant of variants) {
      expect(variant.chatVariant).toBe(true);
      expect(getExperienceSurfaceBySlug("chat")?.tryHref).toBe("/");
    }
  });
});
