import type { PaintingMetrics } from "./painting-state";

import { measureChange, measurePainting } from "./painting-metrics";
import { MAX_PAINTING_IMAGE_CHARS } from "./painting-state";

/**
 * Browser-side photo preparation. All pixel work happens here so the server needs no image
 * library: the model gets a downscaled photo, the measured metrics, and a programmatic
 * difference image against the previous photo.
 */

/** Long edge of the photo sent to the vision model and kept as the next "previous". */
const PHOTO_EDGE = 1024;
/** Long edge for palette and value measurement; more pixels only cost time. */
const MEASURE_EDGE = 96;
/** Square both photos are fitted into before comparing. */
const COMPARE_EDGE = 128;
/** The difference image is upscaled so a vision model can read it. */
const DIFF_OUTPUT_EDGE = 256;
const MAX_SOURCE_BYTES = 25 * 1024 * 1024;

type Drawable = ImageBitmap | HTMLImageElement;

async function loadDrawable(source: Blob | string): Promise<Drawable> {
  if (typeof source !== "string" && typeof createImageBitmap === "function") {
    return createImageBitmap(source, { imageOrientation: "from-image" });
  }
  const image = new Image();

  image.src = typeof source === "string" ? source : URL.createObjectURL(source);
  try {
    await image.decode();
  } finally {
    if (typeof source !== "string") URL.revokeObjectURL(image.src);
  }

  return image;
}

const sizeOf = (image: Drawable) =>
  "naturalWidth" in image
    ? { width: image.naturalWidth, height: image.naturalHeight }
    : { width: image.width, height: image.height };

function canvas2d(width: number, height: number) {
  const canvas = document.createElement("canvas");

  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { willReadFrequently: true });

  if (!context) throw new Error("Photo processing is not available in this browser.");

  return { canvas, context };
}

function drawScaled(image: Drawable, edge: number) {
  const { width, height } = sizeOf(image);
  const scale = Math.min(1, edge / Math.max(width, height));
  const target = canvas2d(
    Math.max(1, Math.round(width * scale)),
    Math.max(1, Math.round(height * scale))
  );

  target.context.drawImage(image, 0, 0, target.canvas.width, target.canvas.height);

  return target;
}

/** Fits the image inside a square on a mid-grey mat, so both photos share one frame. */
function drawContained(image: Drawable, edge: number) {
  const { width, height } = sizeOf(image);
  const scale = edge / Math.max(width, height);
  const w = Math.round(width * scale);
  const h = Math.round(height * scale);
  const target = canvas2d(edge, edge);

  target.context.fillStyle = "#808080";
  target.context.fillRect(0, 0, edge, edge);
  target.context.drawImage(image, Math.round((edge - w) / 2), Math.round((edge - h) / 2), w, h);

  return target;
}

function differenceImage(deltas: Float32Array, edge: number): string {
  const small = canvas2d(edge, edge);
  const pixels = small.context.createImageData(edge, edge);

  for (let p = 0; p < deltas.length; p++) {
    // 0.3 in OKLab is a large change; brighter means more change.
    const v = Math.min(255, Math.round((deltas[p] / 0.3) * 255));

    pixels.data.set([v, v, v, 255], p * 4);
  }
  small.context.putImageData(pixels, 0, 0);

  const output = canvas2d(DIFF_OUTPUT_EDGE, DIFF_OUTPUT_EDGE);

  output.context.imageSmoothingEnabled = false;
  output.context.drawImage(small.canvas, 0, 0, DIFF_OUTPUT_EDGE, DIFF_OUTPUT_EDGE);

  return output.canvas.toDataURL("image/png");
}

export type PreparedPaintingPhoto = {
  currentImage: string;
  differenceImage?: string;
  metrics: PaintingMetrics;
};

export async function preparePaintingPhoto(
  file: Blob,
  previousImage: string | null
): Promise<PreparedPaintingPhoto> {
  if (!/^image\/(jpeg|png|webp|heic|heif)$/.test(file.type) && file.type !== "") {
    throw new Error("Choose a JPEG, PNG or WebP photo.");
  }
  if (file.size > MAX_SOURCE_BYTES) throw new Error("That photo is over 25 MB. Try a smaller one.");

  const current = await loadDrawable(file);
  const photo = drawScaled(current, PHOTO_EDGE);
  const currentImage = photo.canvas.toDataURL("image/jpeg", 0.82);

  if (currentImage.length > MAX_PAINTING_IMAGE_CHARS) {
    throw new Error("That photo is too detailed to send. Try a smaller crop.");
  }

  const measure = drawScaled(current, MEASURE_EDGE);
  const measured = measurePainting(
    measure.context.getImageData(0, 0, measure.canvas.width, measure.canvas.height).data
  );

  if (!previousImage) return { currentImage, metrics: { ...measured, change: null } };

  try {
    const previous = await loadDrawable(previousImage);
    const before = drawContained(previous, COMPARE_EDGE);
    const after = drawContained(current, COMPARE_EDGE);
    const { change, deltas } = measureChange(
      before.context.getImageData(0, 0, COMPARE_EDGE, COMPARE_EDGE).data,
      after.context.getImageData(0, 0, COMPARE_EDGE, COMPARE_EDGE).data,
      COMPARE_EDGE,
      COMPARE_EDGE
    );

    return {
      currentImage,
      differenceImage: differenceImage(deltas, COMPARE_EDGE),
      metrics: { ...measured, change },
    };
  } catch {
    // A previous photo that will not decode only costs the comparison, not the update.
    return { currentImage, metrics: { ...measured, change: null } };
  }
}

/** Chat attachments arrive as data or blob URLs; the painting pipeline wants a Blob. */
export async function blobFromUrl(url: string): Promise<Blob> {
  const response = await fetch(url);

  if (!response.ok) throw new Error("Could not read the attached photo.");

  return response.blob();
}
