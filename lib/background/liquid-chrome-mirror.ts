/**
 * Geometry and compositing for re-rendering a LiquidChrome background inside another canvas.
 *
 * FluidGlass bends the page behind the voice bar. It cannot read the page's pixels, so it
 * reproduces them: the LiquidChrome field is recomputed for the bar's patch of screen, and then
 * composited the way the browser composites it — faded by the chrome wrapper's CSS opacity over
 * whatever is painted beneath. Everything here answers "what colour is the user seeing behind this
 * rectangle right now", without sampling a pixel.
 */

export type RectLike = Pick<DOMRectReadOnly, "left" | "top" | "width" | "height">;

export type ChromeUvTransform = {
  /** Field UV of the bar's bottom-left corner. */
  offset: [number, number];
  /** Field-UV extent of the bar. `fieldUv = offset + barUv × scale`. */
  scale: [number, number];
};

/**
 * Maps the bar's own UV square onto the chrome field's UV space.
 *
 * Both UV spaces put (0, 0) at the bottom-left, as GL does; client rects grow downward, which is
 * where the y-flip comes from. A bar pixel with zero refraction then samples the field at exactly
 * the screen position it covers — which is what makes the glass's edges vanish into the page.
 */
export function chromeUvTransform(bar: RectLike, chrome: RectLike): ChromeUvTransform {
  const width = chrome.width || 1;
  const height = chrome.height || 1;
  const chromeBottom = chrome.top + chrome.height;
  const barBottom = bar.top + bar.height;

  return {
    offset: [(bar.left - chrome.left) / width, (chromeBottom - barBottom) / height],
    scale: [bar.width / width, bar.height / height],
  };
}

export type OpacityChain = {
  /** Product of CSS opacity from the element up to the root — what the user actually sees. */
  opacity: number;
  /**
   * The outermost ancestor with opacity below 1. Whatever is painted beneath *it* shows through
   * the fade; `null` when nothing in the chain is translucent.
   */
  fadeRoot: Element | null;
};

/**
 * Effective opacity of an element, including an in-flight CSS transition.
 *
 * AdaptiveLiquidChrome dims by transitioning its wrapper's `opacity`. `getComputedStyle` returns
 * the interpolated value mid-transition, so reading it per frame tracks the dim exactly.
 */
export function effectiveOpacity(element: Element): OpacityChain {
  let opacity = 1;
  let fadeRoot: Element | null = null;

  for (let node: Element | null = element; node; node = node.parentElement) {
    const value = Number.parseFloat(getComputedStyle(node).opacity);

    if (Number.isFinite(value) && value < 1) {
      opacity *= Math.max(0, value);
      fadeRoot = node;
    }
  }

  return { opacity, fadeRoot };
}

export type Rgba = [number, number, number, number];

const TRANSPARENT: Rgba = [0, 0, 0, 0];

let probe: CanvasRenderingContext2D | null | undefined;

function colourProbe(): CanvasRenderingContext2D | null {
  if (probe !== undefined) return probe;

  try {
    const canvas = document.createElement("canvas");

    canvas.width = 1;
    canvas.height = 1;
    probe = canvas.getContext("2d", { willReadFrequently: true });
  } catch {
    probe = null;
  }

  return probe;
}

/** `rgb()` / `rgba()` in either comma or space syntax, 0–255 channels. */
export function parseRgbFunction(css: string): Rgba | null {
  const match = css.match(/rgba?\(\s*([^)]+)\)/i);

  if (!match) return null;

  const parts = match[1]!
    .split(/[\s,/]+/)
    .filter(Boolean)
    .map((part) => (part.endsWith("%") ? Number.parseFloat(part) / 100 : Number.parseFloat(part)));

  if (parts.length < 3 || parts.slice(0, 3).some((n) => !Number.isFinite(n))) return null;

  const alpha = parts[3] ?? 1;

  return [parts[0]! / 255, parts[1]! / 255, parts[2]! / 255, Number.isFinite(alpha) ? alpha : 1];
}

/**
 * Any CSS colour to sRGB 0–1.
 *
 * The app's tokens are oklch, and computed styles keep that space, so a regex cannot be the main
 * path. Painting one pixel lets the browser do the conversion for any syntax it understands. The
 * regex path covers environments without a 2D canvas (tests).
 */
export function cssColorToRgba(css: string): Rgba {
  const value = css.trim();

  if (!value || value === "transparent") return TRANSPARENT;

  const context = colourProbe();

  if (context) {
    context.clearRect(0, 0, 1, 1);
    context.fillStyle = "rgba(0, 0, 0, 0)";
    context.fillStyle = value;
    context.fillRect(0, 0, 1, 1);

    const [r, g, b, a] = context.getImageData(0, 0, 1, 1).data;

    return [r! / 255, g! / 255, b! / 255, a! / 255];
  }

  return parseRgbFunction(value) ?? TRANSPARENT;
}

/** Canvas default when nothing up the tree paints a background. */
const ROOT_FALLBACK: [number, number, number] = [1, 1, 1];

/**
 * The colour painted beneath `start`, found by compositing ancestor backgrounds from the first
 * opaque one back down (source-over). Siblings that happen to overlap are not considered — for a
 * fixed background layer sitting under a page this is the tree that matters.
 */
export function resolveBackdropRgb(start: Element | null): [number, number, number] {
  const layers: Rgba[] = [];
  let base = ROOT_FALLBACK;

  for (let node: Element | null = start; node; node = node.parentElement) {
    const colour = cssColorToRgba(getComputedStyle(node).backgroundColor);

    if (colour[3] >= 0.999) {
      base = [colour[0], colour[1], colour[2]];
      break;
    }
    if (colour[3] > 0) layers.push(colour);
  }

  let [r, g, b] = base;

  for (let i = layers.length - 1; i >= 0; i--) {
    const [lr, lg, lb, la] = layers[i]!;

    r = lr * la + r * (1 - la);
    g = lg * la + g * (1 - la);
    b = lb * la + b * (1 - la);
  }

  return [r, g, b];
}
