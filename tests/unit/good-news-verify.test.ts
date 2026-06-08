import { describe, expect, test } from "bun:test";

import { buildVerifiedSources, evaluateCorroboration } from "@/lib/good-news/verify";
import { classifyUrl, extractRootDomain, isAllowedUrl } from "@/lib/good-news/sources";

describe("source classification", () => {
  test("classifies high-trust and standard domains", () => {
    expect(classifyUrl("https://www.reuters.com/world/article")).toBe("high_trust");
    expect(classifyUrl("https://apnews.com/x")).toBe("high_trust");
    expect(classifyUrl("https://www.theguardian.com/x")).toBe("standard");
    expect(classifyUrl("https://www.goodnewsnetwork.org/x")).toBe("standard");
  });

  test("matches subdomains of allowlisted domains", () => {
    expect(classifyUrl("https://apps.who.int/news")).toBe("high_trust");
    expect(classifyUrl("https://subdomain.nature.com/article")).toBe("high_trust");
  });

  test("rejects non-allowlisted domains", () => {
    expect(classifyUrl("https://randomblog.example.com/x")).toBeNull();
    expect(isAllowedUrl("https://randomblog.example.com/x")).toBe(false);
    expect(classifyUrl("not a url")).toBeNull();
  });

  test("extractRootDomain strips www and lowercases", () => {
    expect(extractRootDomain("https://WWW.Reuters.com/x")).toBe("reuters.com");
    expect(extractRootDomain("garbage")).toBeNull();
  });
});

describe("evaluateCorroboration", () => {
  test("passes with a single high-trust source", () => {
    const r = evaluateCorroboration(["https://reuters.com/a"]);

    expect(r.passed).toBe(true);
    expect(r.highTrustDomains).toEqual(["reuters.com"]);
  });

  test("fails with a single standard source", () => {
    const r = evaluateCorroboration(["https://theguardian.com/a"]);

    expect(r.passed).toBe(false);
    expect(r.standardDomains).toEqual(["theguardian.com"]);
  });

  test("passes with two distinct standard sources", () => {
    const r = evaluateCorroboration(["https://theguardian.com/a", "https://npr.org/b"]);

    expect(r.passed).toBe(true);
    expect(r.distinctDomains.sort()).toEqual(["npr.org", "theguardian.com"]);
  });

  test("two articles from the same standard outlet do not corroborate", () => {
    const r = evaluateCorroboration([
      "https://theguardian.com/a",
      "https://www.theguardian.com/b",
    ]);

    expect(r.passed).toBe(false);
    expect(r.standardDomains).toEqual(["theguardian.com"]);
  });

  test("ignores non-allowlisted URLs entirely", () => {
    const r = evaluateCorroboration([
      "https://randomblog.example.com/a",
      "https://anotherblog.example.org/b",
    ]);

    expect(r.passed).toBe(false);
    expect(r.distinctDomains).toEqual([]);
  });
});

describe("buildVerifiedSources", () => {
  test("resolves tier/domain from allowlist and dedupes by domain", () => {
    const meta = new Map([
      ["https://reuters.com/a", { title: "Reuters story", publishedAt: "2026-05-30" }],
      ["https://www.theguardian.com/b", { title: "Guardian story" }],
    ]);

    const sources = buildVerifiedSources(
      ["https://reuters.com/a", "https://www.theguardian.com/b", "https://evil.example.com/c"],
      meta
    );

    expect(sources).toHaveLength(2);
    // high-trust sorts first
    expect(sources[0].domain).toBe("reuters.com");
    expect(sources[0].tier).toBe("high_trust");
    expect(sources[1].domain).toBe("theguardian.com");
    expect(sources[1].tier).toBe("standard");
  });

  test("falls back to domain as title when metadata is missing", () => {
    const sources = buildVerifiedSources(["https://apnews.com/a"], new Map());

    expect(sources[0].title).toBe("apnews.com");
  });
});
