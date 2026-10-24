import { describe, expect, test } from "bun:test";

import {
  buildPromptSafeRawInputBlock,
  sanitizeRawUserInput,
  sanitizeUntrustedText,
  wrapUntrustedContent,
  wrapWebSearchResultsForModel,
} from "@/lib/security/external-content/untrusted";

describe("sanitizeUntrustedText", () => {
  test("removes script tags and javascript: protocols", () => {
    const input = '<script>alert(1)</script>Click <a href="javascript:alert(1)">here</a>';
    const output = sanitizeUntrustedText(input);

    expect(output).not.toContain("<script");
    expect(output).not.toContain("javascript:");
    expect(output).toContain("blocked-protocol:");
  });
});

describe("wrapUntrustedContent", () => {
  test("returns JSON envelope with untrusted note", () => {
    const wrapped = wrapUntrustedContent({
      kind: "webpage",
      sourceUrl: "https://example.com",
      title: "Example",
      text: "Article body",
    });
    const parsed = JSON.parse(wrapped) as {
      untrustedExternalContent: { kind: string; text: string };
      note: string;
    };

    expect(parsed.untrustedExternalContent.kind).toBe("webpage");
    expect(parsed.untrustedExternalContent.text).toBe("Article body");
    expect(parsed.note).toContain("untrusted");
  });
});

describe("Strata compatibility exports", () => {
  test("sanitizeRawUserInput delegates to sanitizeUntrustedText", () => {
    expect(sanitizeRawUserInput("  hello  ")).toBe("  hello");
  });

  test("buildPromptSafeRawInputBlock wraps raw input (legacy key)", () => {
    const block = buildPromptSafeRawInputBlock("user text");
    const parsed = JSON.parse(block) as { untrustedRawUserInput: string };

    expect(parsed.untrustedRawUserInput).toBe("user text");
  });
});

describe("wrapWebSearchResultsForModel", () => {
  test("sanitizes search result fields", () => {
    const wrapped = wrapWebSearchResultsForModel([
      {
        title: "Title<script>",
        url: "https://example.com",
        snippet: "Snippet<script>",
      },
    ]);
    const parsed = JSON.parse(wrapped) as {
      untrustedWebSearchResults: Array<{ title: string; snippet: string }>;
    };

    expect(parsed.untrustedWebSearchResults[0]?.title).not.toContain("<script");
    expect(parsed.untrustedWebSearchResults[0]?.snippet).not.toContain("<script");
  });
});
