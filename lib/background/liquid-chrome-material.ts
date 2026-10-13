export type LiquidChromeMaterial = "chrome" | "paper-ink";

/** Approved light-mode material; keep the background and refraction on the same palette. */
export const PAPER_INK_MATERIAL = {
  paperColor: [247 / 255, 245 / 255, 239 / 255] as [number, number, number],
  pigmentColor: [69 / 255, 72 / 255, 66 / 255] as [number, number, number],
  amplitude: 0.14,
  density: 0.42,
  spread: 0.27,
  widthVariance: 0.45,
  coreVariance: 0.65,
  gradientSoftness: 0.7,
  paperGrain: 0.028,
  edgeTexture: 0.65,
};
