import type { PaintingChangeMetrics, PaintingMetrics, PaintingSwatch } from "./painting-state";

/**
 * Pure pixel math for painting photos: palette by area, value structure, warm/cool balance, and
 * change between two photos. Runs on RGBA buffers, so the browser can call it on canvas data
 * and tests can call it on synthetic arrays. Colour work happens in OKLab, where distance and
 * lightness track perception far better than RGB.
 */

export type Oklab = { L: number; a: number; b: number };

const srgbToLinear = (channel: number) => {
  const c = channel / 255;

  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};

const linearToSrgb = (channel: number) => {
  const c = Math.min(1, Math.max(0, channel));
  const v = c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055;

  return Math.round(v * 255);
};

export function rgbToOklab(r: number, g: number, b: number): Oklab {
  const lr = srgbToLinear(r);
  const lg = srgbToLinear(g);
  const lb = srgbToLinear(b);
  const l = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb);
  const m = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb);
  const s = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb);

  return {
    L: 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    a: 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    b: 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  };
}

export function oklabToHex({ L, a, b }: Oklab): string {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const channels = [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];

  return `#${channels.map((c) => linearToSrgb(c).toString(16).padStart(2, "0")).join("")}`;
}

/** Value bands on OKLab lightness; #333 ≈ 0.32, mid grey ≈ 0.6, #ccc ≈ 0.85. */
const VALUE_EDGES = [0.3, 0.45, 0.65, 0.82] as const;
const CHROMATIC = 0.04;

export function valueBandIndex(L: number): 0 | 1 | 2 | 3 | 4 {
  if (L < VALUE_EDGES[0]) return 0;
  if (L < VALUE_EDGES[1]) return 1;
  if (L < VALUE_EDGES[2]) return 2;
  if (L < VALUE_EDGES[3]) return 3;

  return 4;
}

const VALUE_WORDS = ["very dark", "dark", "mid", "light", "very light"] as const;

function hueAngle(lab: Oklab): number {
  const degrees = (Math.atan2(lab.b, lab.a) * 180) / Math.PI;

  return degrees < 0 ? degrees + 360 : degrees;
}

/** Reds through yellows; OKLab red sits near 29° and yellow near 110°. */
function isWarmHue(hue: number): boolean {
  return hue >= 340 || hue <= 115;
}

function hueWord(lab: Oklab): string {
  const hue = hueAngle(lab);

  // Dark, low-to-moderate chroma reds, oranges and yellows read as browns.
  if (hue >= 15 && hue < 120 && lab.L < 0.55 && Math.hypot(lab.a, lab.b) < 0.12) return "brown";
  if (hue < 40 || hue >= 345) return "red";
  if (hue < 75) return "orange";
  if (hue < 120) return "yellow";
  if (hue < 165) return "green";
  if (hue < 215) return "teal";
  if (hue < 285) return "blue";
  if (hue < 325) return "violet";

  return "magenta";
}

/** Plain-language label a painter would use: "very dark cool neutral", "light muted teal". */
export function describeOklab(lab: Oklab): string {
  const chroma = Math.hypot(lab.a, lab.b);
  const value = VALUE_WORDS[valueBandIndex(lab.L)];

  if (chroma < 0.025) {
    if (lab.L > 0.93) return "white";
    if (lab.L < 0.2) return "near-black";
    const temperature = lab.b > 0.006 ? "warm " : lab.b < -0.006 ? "cool " : "";

    return `${value} ${temperature}grey`;
  }
  if (chroma < 0.06) return `${value} muted ${hueWord(lab)}`;

  return `${value} ${chroma > 0.15 ? "saturated " : ""}${hueWord(lab)}`;
}

function toLabArray(rgba: Uint8ClampedArray): Oklab[] {
  const out: Oklab[] = [];

  for (let i = 0; i < rgba.length; i += 4) {
    if (rgba[i + 3] < 128) continue;
    out.push(rgbToOklab(rgba[i], rgba[i + 1], rgba[i + 2]));
  }

  return out;
}

const distanceSq = (x: Oklab, y: Oklab) => (x.L - y.L) ** 2 + (x.a - y.a) ** 2 + (x.b - y.b) ** 2;

/**
 * k-means in OKLab, seeded at evenly spaced lightness quantiles so results are deterministic
 * and follow the painting's value structure. Clusters under `minShare` are dropped and the
 * remaining shares renormalised.
 */
export function extractPalette(
  pixels: Oklab[],
  options: { k?: number; iterations?: number; minShare?: number } = {}
): PaintingSwatch[] {
  const k = Math.min(options.k ?? 6, pixels.length);

  if (k === 0) return [];
  const sorted = [...pixels].sort((x, y) => x.L - y.L);
  let centroids = Array.from({ length: k }, (_, i) => ({
    ...sorted[Math.min(sorted.length - 1, Math.floor(((i + 0.5) / k) * sorted.length))],
  }));
  const assignment = new Int32Array(pixels.length);

  for (let iteration = 0; iteration < (options.iterations ?? 12); iteration++) {
    let moved = false;

    for (let p = 0; p < pixels.length; p++) {
      let best = 0;
      let bestDistance = Infinity;

      for (let c = 0; c < centroids.length; c++) {
        const d = distanceSq(pixels[p], centroids[c]);

        if (d < bestDistance) {
          bestDistance = d;
          best = c;
        }
      }
      if (assignment[p] !== best) moved = true;
      assignment[p] = best;
    }

    const sums = centroids.map(() => ({ L: 0, a: 0, b: 0, n: 0 }));

    for (let p = 0; p < pixels.length; p++) {
      const sum = sums[assignment[p]];

      sum.L += pixels[p].L;
      sum.a += pixels[p].a;
      sum.b += pixels[p].b;
      sum.n += 1;
    }
    centroids = sums.map((sum, c) =>
      sum.n > 0 ? { L: sum.L / sum.n, a: sum.a / sum.n, b: sum.b / sum.n } : centroids[c]
    );
    if (!moved && iteration > 0) break;
  }

  const counts = new Array(centroids.length).fill(0);

  for (let p = 0; p < pixels.length; p++) counts[assignment[p]] += 1;

  const minShare = options.minShare ?? 0.02;
  const kept = centroids
    .map((centroid, c) => ({ centroid, share: counts[c] / pixels.length }))
    .filter((cluster) => cluster.share >= minShare);
  const total = kept.reduce((sum, cluster) => sum + cluster.share, 0) || 1;

  return kept
    .map(({ centroid, share }) => ({
      hex: oklabToHex(centroid),
      share: Math.round((share / total) * 1000) / 1000,
      label: describeOklab(centroid),
    }))
    .sort((x, y) => y.share - x.share);
}

const round3 = (value: number) => Math.round(value * 1000) / 1000;

/** Palette, value bands, warm share and mean lightness for one photo. */
export function measurePainting(rgba: Uint8ClampedArray): Omit<PaintingMetrics, "change"> {
  const pixels = toLabArray(rgba);
  const bands = [0, 0, 0, 0, 0];
  let lightness = 0;
  let chromatic = 0;
  let warm = 0;

  for (const pixel of pixels) {
    bands[valueBandIndex(pixel.L)] += 1;
    lightness += pixel.L;
    if (Math.hypot(pixel.a, pixel.b) >= CHROMATIC) {
      chromatic += 1;
      if (isWarmHue(hueAngle(pixel))) warm += 1;
    }
  }

  const n = pixels.length || 1;

  return {
    palette: extractPalette(pixels),
    values: {
      veryDark: round3(bands[0] / n),
      dark: round3(bands[1] / n),
      mid: round3(bands[2] / n),
      light: round3(bands[3] / n),
      veryLight: round3(bands[4] / n),
    },
    warmShare: round3(chromatic > 0 ? warm / chromatic : 0),
    meanLightness: round3(Math.min(1, Math.max(0, lightness / n))),
  };
}

/** OKLab distance past which a pixel counts as changed. */
export const CHANGE_THRESHOLD = 0.08;

/**
 * Change between two same-size RGBA frames. The global lightness shift is removed first, so a
 * brighter or darker photo of the same painting does not register as repainting everywhere.
 * Returns per-pixel distances too, for the diagnostic difference image.
 */
export function measureChange(
  previous: Uint8ClampedArray,
  current: Uint8ClampedArray,
  width: number,
  height: number
): { change: PaintingChangeMetrics; deltas: Float32Array } {
  if (previous.length !== current.length || previous.length !== width * height * 4) {
    throw new Error("Frames must share dimensions to compare.");
  }
  const count = width * height;
  const before: Oklab[] = new Array(count);
  const after: Oklab[] = new Array(count);
  let meanBefore = 0;
  let meanAfter = 0;

  for (let p = 0; p < count; p++) {
    const i = p * 4;

    before[p] = rgbToOklab(previous[i], previous[i + 1], previous[i + 2]);
    after[p] = rgbToOklab(current[i], current[i + 1], current[i + 2]);
    meanBefore += before[p].L;
    meanAfter += after[p].L;
  }
  const shift = (meanAfter - meanBefore) / count;
  const deltas = new Float32Array(count);
  const grid = new Array(9).fill(0);
  const gridTotals = new Array(9).fill(0);
  let changed = 0;
  let sumDelta = 0;
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const p = y * width + x;
      const d = Math.sqrt(
        (after[p].L - shift - before[p].L) ** 2 +
          (after[p].a - before[p].a) ** 2 +
          (after[p].b - before[p].b) ** 2
      );
      const cell =
        Math.min(2, Math.floor((y / height) * 3)) * 3 + Math.min(2, Math.floor((x / width) * 3));

      deltas[p] = d;
      sumDelta += Math.min(1, d);
      gridTotals[cell] += 1;
      if (d > CHANGE_THRESHOLD) {
        changed += 1;
        grid[cell] += 1;
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }
  }

  const changedShare = changed / count;

  return {
    deltas,
    change: {
      changedShare: round3(changedShare),
      meanDelta: round3(sumDelta / count),
      lightnessShift: round3(Math.max(-1, Math.min(1, shift))),
      bounds:
        changedShare > 0.002 && maxX >= 0
          ? {
              x: round3(minX / width),
              y: round3(minY / height),
              width: round3((maxX - minX + 1) / width),
              height: round3((maxY - minY + 1) / height),
            }
          : null,
      grid: grid.map((value, cell) => round3(gridTotals[cell] ? value / gridTotals[cell] : 0)),
    },
  };
}

const GRID_NAMES = [
  "top left",
  "top centre",
  "top right",
  "middle left",
  "centre",
  "middle right",
  "bottom left",
  "bottom centre",
  "bottom right",
] as const;

/** One line a model or a person can read: "Palette by area: 46% very dark cool grey (#2b2620), …". */
export function formatPaintingMetrics(metrics: PaintingMetrics): string {
  const pct = (value: number) => `${Math.round(value * 100)}%`;
  const lines = [
    `Palette by area: ${metrics.palette.map((swatch) => `${pct(swatch.share)} ${swatch.label} (${swatch.hex})`).join(", ") || "unknown"}.`,
    `Values: ${pct(metrics.values.veryDark)} very dark, ${pct(metrics.values.dark)} dark, ${pct(metrics.values.mid)} mid, ${pct(metrics.values.light)} light, ${pct(metrics.values.veryLight)} very light.`,
    `Of the coloured areas, ${pct(metrics.warmShare)} are warm.`,
  ];
  const change = metrics.change;

  if (change) {
    const cells = change.grid
      .map((value, cell) => ({ value, name: GRID_NAMES[cell] }))
      .filter((cell) => cell.value >= 0.05)
      .sort((x, y) => y.value - x.value)
      .slice(0, 3)
      .map((cell) => `${cell.name} ${pct(cell.value)}`);

    lines.push(
      `Pixel change since the previous photo: ${pct(change.changedShare)} of the frame${cells.length ? ` (most in ${cells.join(", ")})` : ""}; overall lightness shift ${change.lightnessShift >= 0 ? "+" : ""}${change.lightnessShift.toFixed(2)}. Photos are not registered, so camera movement shows up as change.`
    );
  }

  return lines.join("\n");
}
