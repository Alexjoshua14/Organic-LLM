import { afterEach, beforeEach, describe, expect, test } from "bun:test";

import {
  assertLiquidChromeFramesFilled,
  sampleLiquidChromeFrames,
} from "@/lib/background/liquid-chrome-render-guard";

import { installTestJsdom } from "../helpers/install-test-jsdom";

describe("sampleLiquidChromeFrames", () => {
  beforeEach(() => {
    installTestJsdom();
    document.documentElement.innerHTML = `
      <body>
        <section
          data-page-chrome="inset"
          class="page-liquid-chrome app-shell"
          style="background: radial-gradient(ellipse 120% 80% at 50% 40%, rgb(128, 122, 117) 0%, rgb(138, 132, 127) 100%);"
        ></section>
      </body>
    `;
  });

  afterEach(() => {
    document.documentElement.innerHTML = "";
  });

  test("reports filled backgrounds for the first four animation frames", async () => {
    const samples = await sampleLiquidChromeFrames(4);

    expect(samples).toHaveLength(4);
    expect(samples.every((sample) => sample.filled)).toBe(true);
    expect(samples.every((sample) => !sample.missing)).toBe(true);
    assertLiquidChromeFramesFilled(samples);
  });

  test("detects regression when fill class is missing", async () => {
    document.querySelector("section")?.classList.remove("page-liquid-chrome");

    const samples = await sampleLiquidChromeFrames(2);

    expect(samples.every((sample) => !sample.filled)).toBe(true);
    expect(() => assertLiquidChromeFramesFilled(samples)).toThrow(/flash detected/i);
  });
});
