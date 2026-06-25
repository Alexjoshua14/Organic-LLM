import {
  assertLiquidChromeFramesFilled,
  ssrHtmlIncludesChromeFill,
  ssrHtmlLacksChromeFill,
  type LiquidChromeFrameSample,
} from "@/lib/background/liquid-chrome-render-guard";

export { ssrHtmlIncludesChromeFill, ssrHtmlLacksChromeFill };

/** Runs in the browser via page.evaluate — must stay self-contained (no module imports). */
export async function sampleLiquidChromeFramesInPage(
  frameCount: number
): Promise<LiquidChromeFrameSample[]> {
  const selectors = ["section.page-liquid-chrome", ".liquid-chrome-page-fill"];

  const parseRgb = (input: string) => {
    const value = input.trim().toLowerCase();
    if (value === "transparent") return { a: 0, r: 0, g: 0, b: 0 };
    const rgb = value.match(/^rgb\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*\)$/);
    if (rgb) {
      return { r: Number(rgb[1]), g: Number(rgb[2]), b: Number(rgb[3]), a: 1 };
    }
    const rgba = value.match(
      /^rgba\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*\)$/
    );
    if (rgba) {
      return {
        r: Number(rgba[1]),
        g: Number(rgba[2]),
        b: Number(rgba[3]),
        a: Number(rgba[4]),
      };
    }
    return null;
  };

  const isFilled = (backgroundColor: string, backgroundImage: string) => {
    if (backgroundImage && backgroundImage !== "none") return true;
    const rgb = parseRgb(backgroundColor);
    if (!rgb) return backgroundColor !== "transparent";
    if (rgb.a < 0.05) return false;
    if (rgb.r > 250 && rgb.g > 250 && rgb.b > 250) return false;
    return true;
  };

  const samples: LiquidChromeFrameSample[] = [];

  for (let frame = 0; frame < frameCount; frame += 1) {
    if (frame > 0) {
      await new Promise<void>((resolve) => {
        requestAnimationFrame(() => resolve());
      });
    }

    let element: Element | null = null;
    let selector = selectors.join(", ");

    for (const candidate of selectors) {
      const match = document.querySelector(candidate);
      if (match) {
        element = match;
        selector = candidate;
        break;
      }
    }

    if (!element) {
      samples.push({
        frame,
        selector,
        filled: false,
        backgroundColor: "transparent",
        backgroundImage: "none",
        missing: true,
      });
      continue;
    }

    const style = window.getComputedStyle(element);
    const backgroundColor = style.backgroundColor;
    const backgroundImage = style.backgroundImage;

    samples.push({
      frame,
      selector,
      filled: isFilled(backgroundColor, backgroundImage),
      backgroundColor,
      backgroundImage,
      missing: false,
    });
  }

  return samples;
}

export function assertFramesFilled(samples: LiquidChromeFrameSample[]): void {
  assertLiquidChromeFramesFilled(samples);
}
