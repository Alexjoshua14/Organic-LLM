import { describe, expect, test } from "bun:test";

import { loadDevDocMarkdown } from "@/lib/dev-docs/load-doc";
import { DEV_DOCS, getDevDocBySlug } from "@/lib/dev-docs/registry";

describe("dev docs registry", () => {
  test("every entry has a unique slug and resolvable markdown file", () => {
    const slugs = DEV_DOCS.map((doc) => doc.slug);

    expect(new Set(slugs).size).toBe(slugs.length);

    for (const doc of DEV_DOCS) {
      expect(getDevDocBySlug(doc.slug)).toEqual(doc);
      const markdown = loadDevDocMarkdown(doc.slug);

      expect(markdown.trim().length).toBeGreaterThan(0);
      expect(markdown.startsWith("#")).toBe(true);
    }
  });
});
