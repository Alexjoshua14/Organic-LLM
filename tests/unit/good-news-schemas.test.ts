import { describe, expect, test } from "bun:test";

import {
  CandidateExtractionSchema,
  FactCheckResultSchema,
  GoodNewsDigestSchema,
  GoodNewsItemSchema,
} from "@/lib/schemas/good-news";

const validItem = {
  rank: 1,
  headline: "Researchers report a major step toward a malaria vaccine",
  summary: "A new trial showed strong protection in young children.",
  whyItMatters: "Malaria kills hundreds of thousands of children each year.",
  category: "health",
  sources: [
    {
      title: "Trial results published",
      url: "https://www.nature.com/articles/x",
      domain: "nature.com",
      tier: "high_trust",
      publishedAt: "2026-05-29",
    },
  ],
  publishedAt: "2026-05-29",
  confidence: 0.92,
  verification: "Confirmed by the published trial.",
};

describe("GoodNewsItemSchema", () => {
  test("accepts a well-formed item", () => {
    expect(GoodNewsItemSchema.safeParse(validItem).success).toBe(true);
  });

  test("rejects an item with no sources", () => {
    expect(GoodNewsItemSchema.safeParse({ ...validItem, sources: [] }).success).toBe(false);
  });

  test("rejects an invalid category", () => {
    expect(GoodNewsItemSchema.safeParse({ ...validItem, category: "gossip" }).success).toBe(false);
  });

  test("rejects confidence out of range", () => {
    expect(GoodNewsItemSchema.safeParse({ ...validItem, confidence: 1.5 }).success).toBe(false);
  });

  test("rejects a non-URL source", () => {
    const bad = {
      ...validItem,
      sources: [{ ...validItem.sources[0], url: "not-a-url" }],
    };

    expect(GoodNewsItemSchema.safeParse(bad).success).toBe(false);
  });
});

describe("GoodNewsDigestSchema", () => {
  test("accepts a valid digest", () => {
    const digest = {
      date: "2026-05-31",
      items: [validItem],
      generatedAt: new Date().toISOString(),
      model: "openai/gpt-5.2",
    };

    expect(GoodNewsDigestSchema.safeParse(digest).success).toBe(true);
  });

  test("rejects a malformed date", () => {
    const digest = {
      date: "May 31 2026",
      items: [],
      generatedAt: new Date().toISOString(),
      model: "openai/gpt-5.2",
    };

    expect(GoodNewsDigestSchema.safeParse(digest).success).toBe(false);
  });

  test("rejects more than 10 items", () => {
    const digest = {
      date: "2026-05-31",
      items: Array.from({ length: 11 }, (_, i) => ({ ...validItem, rank: i + 1 })),
      generatedAt: new Date().toISOString(),
      model: "openai/gpt-5.2",
    };

    expect(GoodNewsDigestSchema.safeParse(digest).success).toBe(false);
  });
});

describe("LLM stage schemas", () => {
  test("CandidateExtractionSchema requires at least one source URL per candidate", () => {
    const bad = {
      candidates: [
        {
          headline: "x",
          summary: "y",
          claim: "z",
          category: "science",
          sourceUrls: [],
        },
      ],
    };

    expect(CandidateExtractionSchema.safeParse(bad).success).toBe(false);
  });

  test("FactCheckResultSchema validates a supported result", () => {
    const ok = {
      headline: "h",
      summary: "s",
      whyItMatters: "w",
      category: "climate",
      isSupported: true,
      confidence: 0.8,
      verification: "v",
      supportingUrls: ["https://reuters.com/a"],
    };

    expect(FactCheckResultSchema.safeParse(ok).success).toBe(true);
  });
});
