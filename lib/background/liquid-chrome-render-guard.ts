export const LIQUID_CHROME_PAGE_FILL_CLASS = "page-liquid-chrome";
export const LIQUID_CHROME_FIXED_FILL_CLASS = "liquid-chrome-page-fill";

export type LiquidChromeBackgroundSnapshot = {
  backgroundColor: string;
  backgroundImage: string;
};

export type LiquidChromeFrameSample = {
  frame: number;
  selector: string;
  filled: boolean;
  backgroundColor: string;
  backgroundImage: string;
  missing: boolean;
};

type Rgb = { r: number; g: number; b: number; a: number };

/** Selectors for SSR / hydrated liquid chrome fill layers (first match wins). */
export const LIQUID_CHROME_FILL_SELECTORS = [
  `section.${LIQUID_CHROME_PAGE_FILL_CLASS}`,
  `.${LIQUID_CHROME_FIXED_FILL_CLASS}`,
] as const;

export function parseCssRgb(input: string): Rgb | null {
  const value = input.trim().toLowerCase();

  if (value === "transparent") {
    return { r: 0, g: 0, b: 0, a: 0 };
  }

  const rgbMatch = value.match(/^rgb\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*\)$/);
  if (rgbMatch) {
    return {
      r: Number(rgbMatch[1]),
      g: Number(rgbMatch[2]),
      b: Number(rgbMatch[3]),
      a: 1,
    };
  }

  const rgbaMatch = value.match(
    /^rgba\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*\)$/
  );
  if (rgbaMatch) {
    return {
      r: Number(rgbaMatch[1]),
      g: Number(rgbaMatch[2]),
      b: Number(rgbaMatch[3]),
      a: Number(rgbaMatch[4]),
    };
  }

  return null;
}

/** True when the computed background is a chrome gradient or opaque non-white fill. */
export function isLiquidChromeBackgroundFilled(snapshot: LiquidChromeBackgroundSnapshot): boolean {
  const image = snapshot.backgroundImage?.trim();
  if (image && image !== "none") {
    return true;
  }

  const rgb = parseCssRgb(snapshot.backgroundColor);
  if (!rgb) {
    return snapshot.backgroundColor !== "transparent";
  }

  if (rgb.a < 0.05) {
    return false;
  }

  // WebGL clear / default page flash before shader init.
  if (rgb.r > 250 && rgb.g > 250 && rgb.b > 250) {
    return false;
  }

  return true;
}

export function readLiquidChromeBackground(element: Element | null): LiquidChromeBackgroundSnapshot {
  if (!element || typeof window === "undefined") {
    return { backgroundColor: "transparent", backgroundImage: "none" };
  }

  const style = window.getComputedStyle(element);

  return {
    backgroundColor: style.backgroundColor,
    backgroundImage: style.backgroundImage,
  };
}

export function findLiquidChromeFillElement(
  root: ParentNode = document
): { element: Element; selector: string } | null {
  if (typeof document === "undefined") {
    return null;
  }

  for (const selector of LIQUID_CHROME_FILL_SELECTORS) {
    const element = root.querySelector(selector);
    if (element) {
      return { element, selector };
    }
  }

  return null;
}

/** Sample fill state on the current frame and the next `frameCount - 1` animation frames. */
export async function sampleLiquidChromeFrames(frameCount = 4): Promise<LiquidChromeFrameSample[]> {
  if (typeof window === "undefined") {
    return [];
  }

  const samples: LiquidChromeFrameSample[] = [];

  for (let frame = 0; frame < frameCount; frame += 1) {
    if (frame > 0) {
      await new Promise<void>((resolve) => {
        requestAnimationFrame(() => resolve());
      });
    }

    const match = findLiquidChromeFillElement();
    if (!match) {
      samples.push({
        frame,
        selector: LIQUID_CHROME_FILL_SELECTORS.join(", "),
        filled: false,
        backgroundColor: "transparent",
        backgroundImage: "none",
        missing: true,
      });
      continue;
    }

    const background = readLiquidChromeBackground(match.element);

    samples.push({
      frame,
      selector: match.selector,
      filled: isLiquidChromeBackgroundFilled(background),
      backgroundColor: background.backgroundColor,
      backgroundImage: background.backgroundImage,
      missing: false,
    });
  }

  return samples;
}

export function assertLiquidChromeFramesFilled(samples: LiquidChromeFrameSample[]): void {
  const failures = samples.filter((sample) => !sample.filled);

  if (failures.length === 0) {
    return;
  }

  const detail = failures
    .map(
      (sample) =>
        `frame ${sample.frame} (${sample.selector}): color=${sample.backgroundColor}, image=${sample.backgroundImage}, missing=${sample.missing}`
    )
    .join("; ");

  throw new Error(`Liquid chrome background flash detected: ${detail}`);
}
