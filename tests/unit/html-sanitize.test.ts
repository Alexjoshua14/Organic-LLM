import { describe, expect, test } from "bun:test";

import {
  reSanitizeArticleHtmlInBrowser,
  sanitizeMermaidSvgMarkup,
} from "@/lib/html/sanitize-browser";
import { sanitizeRabbitHoleArticleHtml } from "@/lib/html/sanitize";

describe("sanitizeRabbitHoleArticleHtml", () => {
  test("preserves allowed article markup", async () => {
    const input =
      '<h2 id="takeaway-0">Intro</h2><p>Hello <strong>world</strong> <span data-branch-id="b1">branch</span></p>';
    const output = await sanitizeRabbitHoleArticleHtml(input);

    expect(output).toContain('id="takeaway-0"');
    expect(output).toContain("data-branch-id");
    expect(output).toContain("<strong>world</strong>");
  });

  test("strips script tags and event handlers", async () => {
    const input =
      '<p onclick="alert(1)">Hi</p><script>alert("xss")</script><img src=x onerror=alert(1)>';
    const output = await sanitizeRabbitHoleArticleHtml(input);

    expect(output).not.toContain("<script");
    expect(output).not.toContain("onclick");
    expect(output).not.toContain("<img");
  });

  test("blocks javascript: hrefs on links", async () => {
    const input = '<a href="javascript:alert(1)">click</a>';
    const output = await sanitizeRabbitHoleArticleHtml(input);

    expect(output).not.toContain("javascript:");
  });

  test("allows https links", async () => {
    const input = '<a href="https://example.com">safe</a>';
    const output = await sanitizeRabbitHoleArticleHtml(input);

    expect(output).toContain('href="https://example.com"');
  });

  test("preserves blockquote", async () => {
    const input = "<blockquote><p>A quoted passage.</p></blockquote>";
    const output = await sanitizeRabbitHoleArticleHtml(input);

    expect(output).toContain("<blockquote");
    expect(output).toContain("A quoted passage.");
  });
});

describe("sanitizeMermaidSvgMarkup", () => {
  test("preserves basic svg structure", async () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg"><text>ok</text></svg>';
    const output = sanitizeMermaidSvgMarkup(svg);

    expect(output).toContain("<svg");
    expect(output).toContain("ok");
  });

  test("strips script elements from svg", async () => {
    const svg =
      '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script><text>ok</text></svg>';
    const output = sanitizeMermaidSvgMarkup(svg);

    expect(output).not.toContain("<script");
    expect(output).toContain("ok");
  });
});

describe("reSanitizeArticleHtmlInBrowser", () => {
  test("applies the same policy as the server pass", async () => {
    const input =
      '<p onclick="alert(1)">Hi</p><script>alert("xss")</script><a href="javascript:alert(1)">x</a>';

    expect(reSanitizeArticleHtmlInBrowser(input)).toBe(await sanitizeRabbitHoleArticleHtml(input));
  });

  test("strips script tags and event handlers at the sink", async () => {
    const output = reSanitizeArticleHtmlInBrowser(
      '<p onclick="alert(1)">Hi</p><script>alert("xss")</script>'
    );

    expect(output).not.toContain("<script");
    expect(output).not.toContain("onclick");
    expect(output).toContain("Hi");
  });

  test("preserves allowed article markup", async () => {
    const output = reSanitizeArticleHtmlInBrowser(
      '<h2 id="takeaway-0">Intro</h2><p><span data-branch-id="b1">branch</span></p>'
    );

    expect(output).toContain('id="takeaway-0"');
    expect(output).toContain("data-branch-id");
  });
});
