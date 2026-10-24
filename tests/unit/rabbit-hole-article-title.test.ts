import { describe, expect, test } from "bun:test";

import {
  RABBIT_HOLE_ARTICLE_TITLE_MAX,
  resolvedArticleTitle,
} from "@/lib/rabbit-holes/article-title";
import { RABBIT_HOLE_UNTITLED } from "@/lib/rabbit-holes/constants";
import { RabbitHoleAIResponseSchema } from "@/lib/schemas/rabbitHoleSchemas";

describe("resolvedArticleTitle", () => {
  test("truncates titles longer than 80 characters", () => {
    const title = `Cursor Auto vs. Organic LLM: ${"routing ".repeat(20)}`;
    const resolved = resolvedArticleTitle(title);

    expect(title.length).toBeGreaterThan(RABBIT_HOLE_ARTICLE_TITLE_MAX);
    expect(resolved.length).toBeLessThanOrEqual(RABBIT_HOLE_ARTICLE_TITLE_MAX);
    expect(resolved.startsWith("Cursor Auto vs. Organic LLM")).toBe(true);
    expect(resolvedArticleTitle("A".repeat(120))).toHaveLength(RABBIT_HOLE_ARTICLE_TITLE_MAX);
  });

  test("keeps a title that already fits", () => {
    expect(resolvedArticleTitle("Cursor Auto vs. Organic LLM")).toBe(
      "Cursor Auto vs. Organic LLM"
    );
  });

  test("falls back when the model title is empty or too short to store", () => {
    expect(resolvedArticleTitle("  ")).toBe(RABBIT_HOLE_UNTITLED);
    expect(resolvedArticleTitle("AI")).toBe(RABBIT_HOLE_UNTITLED);
  });
});

describe("RabbitHoleAIResponseSchema title", () => {
  test("accepts a title longer than 80 characters so generation is not discarded", () => {
    const parsed = RabbitHoleAIResponseSchema.safeParse({
      title: "A".repeat(120),
      keyTakeaways: ["One", "Two", "Three"],
      articleHtml: "<section><p>Body</p></section>",
    });

    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.title).toHaveLength(120);
      expect(resolvedArticleTitle(parsed.data.title)).toHaveLength(RABBIT_HOLE_ARTICLE_TITLE_MAX);
    }
  });
});
