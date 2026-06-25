import { describe, expect, test } from "bun:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { LiquidChromeSsrFill } from "@/components/background/LiquidChromeSsrFill";
import { ssrHtmlIncludesChromeFill } from "@/lib/background/liquid-chrome-render-guard";

describe("LiquidChromeSsrFill", () => {
  test("renders fixed gradient layer in static markup", () => {
    const html = renderToStaticMarkup(
      createElement(LiquidChromeSsrFill, { id: "test-ssr-fill" })
    );

    expect(html).toContain('id="test-ssr-fill"');
    expect(html).toContain("liquid-chrome-page-fill");
    expect(html).toContain('aria-hidden="true"');
    expect(ssrHtmlIncludesChromeFill(html)).toBe(true);
  });
});
