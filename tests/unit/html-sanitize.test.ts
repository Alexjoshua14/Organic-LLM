import { describe, expect, test } from "bun:test";

import {
  sanitizeMermaidSvgMarkup,
  sanitizeRabbitHoleArticleHtml,
} from "@/lib/html/sanitize";

describe("sanitizeRabbitHoleArticleHtml", () => {
  test("preserves allowed article markup", () => {
    const input =
      '<h2 id="takeaway-0">Intro</h2><p>Hello <strong>world</strong> <span data-branch-id="b1">branch</span></p>';
    const output = sanitizeRabbitHoleArticleHtml(input);

    expect(output).toContain('id="takeaway-0"');
    expect(output).toContain("data-branch-id");
    expect(output).toContain("<strong>world</strong>");
  });

  test("strips script tags and event handlers", () => {
    const input =
      '<p onclick="alert(1)">Hi</p><script>alert("xss")</script><img src=x onerror=alert(1)>';
    const output = sanitizeRabbitHoleArticleHtml(input);

    expect(output).not.toContain("<script");
    expect(output).not.toContain("onclick");
    expect(output).not.toContain("<img");
  });

  test("blocks javascript: hrefs on links", () => {
    const input = '<a href="javascript:alert(1)">click</a>';
    const output = sanitizeRabbitHoleArticleHtml(input);

    expect(output).not.toContain("javascript:");
  });

  test("allows https links", () => {
    const input = '<a href="https://example.com">safe</a>';
    const output = sanitizeRabbitHoleArticleHtml(input);

    expect(output).toContain('href="https://example.com"');
  });
});

describe("sanitizeMermaidSvgMarkup", () => {
  test("preserves basic svg structure", () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg"><text>ok</text></svg>';
    const output = sanitizeMermaidSvgMarkup(svg);

    expect(output).toContain("<svg");
    expect(output).toContain("ok");
  });

  test("strips script elements from svg", () => {
    const svg =
      '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script><text>ok</text></svg>';
    const output = sanitizeMermaidSvgMarkup(svg);

    expect(output).not.toContain("<script");
    expect(output).toContain("ok");
  });
});
