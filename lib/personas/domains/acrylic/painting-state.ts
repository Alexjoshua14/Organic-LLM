import { z } from "zod";

/**
 * The persona's running picture of the user's work in progress. Pixel measurements (palette,
 * values, change) are computed in code from the photos; descriptions come from vision models.
 * Model-facing schemas are lenient and clipped afterwards, because a model overshooting a
 * length limit should shorten an answer, not fail the whole analysis.
 */

export const VALUE_BANDS = ["very dark", "dark", "mid", "light", "very light"] as const;
export const ValueBandSchema = z.enum(VALUE_BANDS);
export type ValueBand = z.infer<typeof ValueBandSchema>;

const share = z.number().min(0).max(1);

export const PaintingSwatchSchema = z.object({
  hex: z.string().regex(/^#[0-9a-f]{6}$/i),
  share,
  label: z.string().max(60),
});

export type PaintingSwatch = z.infer<typeof PaintingSwatchSchema>;

export const PaintingChangeMetricsSchema = z.object({
  /** Share of the frame whose colour moved past the change threshold. */
  changedShare: share,
  meanDelta: share,
  /** Mean lightness now minus before; large values usually mean light or exposure changed. */
  lightnessShift: z.number().min(-1).max(1),
  /** Normalised bounding box of the changed area, or null when nothing changed. */
  bounds: z.object({ x: share, y: share, width: share, height: share }).nullable(),
  /** Changed share per cell of a 3 × 3 grid, row-major from top-left. */
  grid: z.array(share).length(9),
});

export type PaintingChangeMetrics = z.infer<typeof PaintingChangeMetricsSchema>;

export const PaintingMetricsSchema = z.object({
  palette: z.array(PaintingSwatchSchema).max(8),
  values: z.object({
    veryDark: share,
    dark: share,
    mid: share,
    light: share,
    veryLight: share,
  }),
  /** Of the noticeably coloured pixels, the share that is warm (reds through yellows). */
  warmShare: share,
  meanLightness: share,
  change: PaintingChangeMetricsSchema.nullable(),
});

export type PaintingMetrics = z.infer<typeof PaintingMetricsSchema>;

export const PaintingRegionSchema = z.object({
  name: z.string().max(80),
  where: z.string().max(80),
  description: z.string().max(400),
  colors: z.array(z.string().max(60)).max(6),
  value: ValueBandSchema,
  edges: z.enum(["hard", "soft", "lost", "mixed"]),
});

export type PaintingRegion = z.infer<typeof PaintingRegionSchema>;

export const PaintingHistoryEntrySchema = z.object({
  revision: z.number().int().min(1),
  at: z.iso.datetime(),
  change: z.string().max(240),
});

export const PaintingStateSchema = z.object({
  revision: z.number().int().min(1),
  updatedAt: z.iso.datetime(),
  summary: z.string().max(900),
  composition: z.string().max(400),
  regions: z.array(PaintingRegionSchema).max(8),
  techniques: z.array(z.string().max(120)).max(6),
  latestChanges: z.array(z.string().max(240)).max(6),
  uncertainties: z.array(z.string().max(200)).max(5),
  metrics: PaintingMetricsSchema,
  history: z.array(PaintingHistoryEntrySchema).max(8),
});

export type PaintingState = z.infer<typeof PaintingStateSchema>;

/* ---------- model-facing shapes (lenient; clipped by the reducer) ---------- */

const ModelRegionSchema = z.object({
  name: z.string().describe("Short name, e.g. 'eclipse disk', 'lower left shadow'"),
  where: z.string().describe("Location in the frame, e.g. 'upper right'"),
  description: z.string().describe("What is visibly painted there, one or two sentences"),
  colors: z.array(z.string()).describe("Visible colours, plain names"),
  value: ValueBandSchema,
  edges: z.enum(["hard", "soft", "lost", "mixed"]),
});

export const PaintingObservationSchema = z.object({
  kind: z
    .enum(["work_in_progress", "reference", "palette_or_mix", "other"])
    .describe("work_in_progress = the user's own painting on paper or canvas"),
  photoQuality: z.enum(["good", "usable", "poor"]),
  summary: z.string().describe("What the image shows, as it is now"),
  composition: z.string().describe("Placement of the main shapes"),
  regions: z.array(ModelRegionSchema).describe("At most 8 main regions"),
  techniques: z
    .array(z.string())
    .describe("Visible handling only, e.g. 'knife-dragged broken colour'"),
  uncertainties: z.array(z.string()),
});

export type PaintingObservation = z.infer<typeof PaintingObservationSchema>;

export const PaintingComparisonSchema = z.object({
  comparable: z
    .boolean()
    .describe("False when framing, angle or lighting differ too much to compare the paint itself"),
  changes: z.array(
    z.object({
      where: z.string(),
      what: z.string(),
      confidence: z.enum(["low", "medium", "high"]),
    })
  ),
  uncertainties: z.array(z.string()),
});

export type PaintingComparison = z.infer<typeof PaintingComparisonSchema>;

export const PaintingDescriptionSchema = z.object({
  summary: z.string(),
  composition: z.string(),
  regions: z.array(ModelRegionSchema),
  techniques: z.array(z.string()),
  latestChanges: z.array(z.string()),
  uncertainties: z.array(z.string()),
});

export type PaintingDescription = z.infer<typeof PaintingDescriptionSchema>;

/* ---------- requests ---------- */

export const MAX_PAINTING_IMAGE_CHARS = 2_500_000;
export const MAX_PAINTING_REQUEST_BYTES = 6_000_000;

/** Inline images only: the route never fetches a user-provided URL. */
export const PaintingImageSchema = z
  .string()
  .max(MAX_PAINTING_IMAGE_CHARS)
  .regex(/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/);

export const PaintingAnalysisRequestSchema = z.object({
  personaSessionId: z.uuid(),
  currentImage: PaintingImageSchema,
  differenceImage: PaintingImageSchema.optional(),
  metrics: PaintingMetricsSchema,
  /** What the user said alongside the photo, if anything. */
  note: z.string().max(500).optional(),
});

export type PaintingAnalysisRequest = z.infer<typeof PaintingAnalysisRequestSchema>;

export const PaintingAnalysisOutcomeSchema = z.enum([
  "updated",
  "unchanged",
  "not_artwork",
  "poor_photo",
]);

export type PaintingAnalysisOutcome = z.infer<typeof PaintingAnalysisOutcomeSchema>;
