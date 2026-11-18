import { describe, expect, test } from "bun:test";
import fs from "fs";
import path from "path";

import {
  BLOG_POSTS,
  blogPostHref,
  formatBlogDate,
  getBlogPost,
  relatedBlogPosts,
} from "@/lib/blog/posts";

describe("blog post registry", () => {
  test("slugs are unique", () => {
    const slugs = BLOG_POSTS.map((p) => p.slug);

    expect(new Set(slugs).size).toBe(slugs.length);
  });

  test("every post has a page", () => {
    for (const post of BLOG_POSTS) {
      const page = path.join(process.cwd(), "app/blog", post.slug, "page.tsx");

      expect(fs.existsSync(page)).toBe(true);
      expect(blogPostHref(post.slug)).toBe(`/blog/${post.slug}`);
    }
  });

  test("every post has a plain description, a read time and an ISO date", () => {
    for (const post of BLOG_POSTS) {
      expect(post.description.length).toBeGreaterThan(40);
      expect(post.readMinutes).toBeGreaterThan(0);
      expect(post.updated).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  test("related posts never include the post itself and wrap around", () => {
    for (const post of BLOG_POSTS) {
      const related = relatedBlogPosts(post.slug, 2);

      expect(related.length).toBe(2);
      expect(related.map((p) => p.slug)).not.toContain(post.slug);
    }

    const last = BLOG_POSTS[BLOG_POSTS.length - 1];

    expect(relatedBlogPosts(last.slug, 1)[0].slug).toBe(BLOG_POSTS[0].slug);
  });

  test("an unknown slug falls back to the first posts", () => {
    expect(getBlogPost("nope")).toBeUndefined();
    expect(relatedBlogPosts("nope", 2).map((p) => p.slug)).toEqual(
      BLOG_POSTS.slice(0, 2).map((p) => p.slug)
    );
  });

  test("dates show month and year in UTC", () => {
    expect(formatBlogDate("2026-11-18")).toBe("Nov 2026");
    expect(formatBlogDate("2026-12-01")).toBe("Dec 2026");
  });
});
