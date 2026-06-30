import { describe, expect, test } from "bun:test";

import {
  isLiquidChromeRoutePath,
  syncErgonSsrFillVisibility,
} from "@/lib/background/liquid-chrome-routes";

import { installTestJsdom } from "../helpers/install-test-jsdom";

describe("liquid-chrome-routes", () => {
  test("matches home and showcase routes", () => {
    expect(isLiquidChromeRoutePath("/")).toBe(true);
    expect(isLiquidChromeRoutePath("/showcase")).toBe(true);
    expect(isLiquidChromeRoutePath("/showcase/anatomy")).toBe(true);
    expect(isLiquidChromeRoutePath("/sandbox/prototypes/glass-fonts")).toBe(true);
    expect(isLiquidChromeRoutePath("/ergon")).toBe(true);
  });

  test("excludes non-chrome routes", () => {
    expect(isLiquidChromeRoutePath("/blog")).toBe(false);
    expect(isLiquidChromeRoutePath("/chat/abc")).toBe(false);
  });

  test("path prefix match does not imply page opted in", () => {
    expect(isLiquidChromeRoutePath("/sandbox/tasks")).toBe(true);
  });

  test("syncErgonSsrFillVisibility toggles layout SSR fill", () => {
    installTestJsdom();
    document.documentElement.innerHTML = `
      <body>
        <div id="ergon-liquid-chrome-ssr-fill" class="liquid-chrome-page-fill"></div>
      </body>
    `;

    syncErgonSsrFillVisibility(false);
    expect(document.getElementById("ergon-liquid-chrome-ssr-fill")?.classList.contains("hidden")).toBe(
      true
    );

    syncErgonSsrFillVisibility(true);
    expect(document.getElementById("ergon-liquid-chrome-ssr-fill")?.classList.contains("hidden")).toBe(
      false
    );

    document.documentElement.innerHTML = "";
  });
});
