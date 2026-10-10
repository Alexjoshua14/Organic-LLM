/**
 * The artist's studio kit for the v0 acrylic domain: paints with their pigments, surfaces,
 * tools, and starting mix recipes that use only these paints. Structured so the prompt, the UI
 * and tests read one source. Pigment facts were checked against retailer pigment data on
 * 2026-09-30 (sources inline). The same-day supply note is per-deployment config, not code,
 * because this repository is public.
 */

export type StudioPaintId =
  | "cadmium-yellow"
  | "raw-umber"
  | "titanium-white"
  | "phthalo-green"
  | "ultramarine-blue"
  | "quinacridone-magenta"
  | "grumbacher-red";

export type StudioPaint = {
  id: StudioPaintId;
  name: string;
  brand: string;
  /** Colour Index pigments, or `null` where the user's exact tube is unconfirmed. */
  pigments: string;
  handling: string;
  source?: string;
};

export const STUDIO_PAINTS: readonly StudioPaint[] = [
  {
    id: "cadmium-yellow",
    name: "Cadmium Yellow (Academy sells it as Cadmium Yellow Medium Hue, C034)",
    brand: "Grumbacher Academy",
    pigments:
      "PY83 diarylide yellow + PY74 arylide yellow + PW6 titanium white — a hue, no cadmium",
    handling:
      "Warm, slightly reddish yellow. Semi-opaque because it already contains white, so its mixes run a little chalky and lighter than a pure transparent yellow would.",
    source:
      "https://www.dickblick.com/items/grumbacher-academy-acrylics-cadmium-yellow-medium-hue-90-ml-tube/",
  },
  {
    id: "raw-umber",
    name: "Raw Umber (C172)",
    brand: "Grumbacher Academy",
    pigments: "PBr7 raw umber + PBk9 ivory black",
    handling:
      "Cool, dark, slightly greenish brown. The added black makes it darker and cooler than straight umber, so it is close to a soft black at full strength and gives cool, greenish greys with white. Strong tinter; fairly opaque thick, translucent thin.",
    source: "https://www.dickblick.com/items/grumbacher-academy-acrylics-raw-umber-90-ml-tube/",
  },
  {
    id: "titanium-white",
    name: "Titanium White",
    brand: "Grumbacher Academy",
    pigments: "PW6 titanium dioxide",
    handling:
      "The most opaque paint on the palette with very high tinting strength. Lightens, cools and chalks a colour; a little goes a long way. Never use it to darken.",
  },
  {
    id: "phthalo-green",
    name: "Phthalo Green",
    brand: "Golden",
    pigments:
      "PG7 if it is Golden's Blue Shade (the common one); Golden's Yellow Shade is PG36 — the user has not said which",
    handling:
      "Transparent, cool, staining, and by far the strongest tinter here: start with a speck on the knife tip. Excellent for deep chromatic darks and glazes.",
    source:
      "https://www.dickblick.com/items/golden-heavy-body-artist-acrylics-phthalo-green-blue-shade-2-oz-tube/",
  },
  {
    id: "ultramarine-blue",
    name: "Ultramarine Blue",
    brand: "brand unstated (likely Grumbacher Academy, which comes in the same 6-colour set)",
    pigments:
      "Academy's version is PB29 ultramarine + PV23 dioxazine violet + PBk9 ivory black; other brands are usually PB29 alone",
    handling:
      "Deep, warm, violet-leaning blue; semi-transparent with moderate tinting strength. Academy's black and violet make it darker straight from the tube. Neutralises raw umber and Grumbacher Red toward black.",
    source:
      "https://www.dickblick.com/items/grumbacher-academy-acrylics-ultramarine-blue-90-ml-tube/",
  },
  {
    id: "quinacridone-magenta",
    name: "Quinacridone Magenta",
    brand: "Golden",
    pigments: "PR122 quinacridone magenta",
    handling:
      "Semi-transparent, cool bluish red with lower tinting strength than the phthalo. A clean glazing colour; with ultramarine it makes clean violets, with phthalo green a deep neutral dark.",
    source:
      "https://www.dickblick.com/items/golden-heavy-body-artist-acrylics-quinacridone-magenta-2-oz-tube/",
  },
  {
    id: "grumbacher-red",
    name: "Grumbacher Red (C095)",
    brand: "Grumbacher Academy",
    pigments: "PR112 naphthol red AS-D + PBk9 ivory black",
    handling:
      "Intense warm scarlet, semi-transparent with weak covering power, heavily staining. The touch of black makes it read slightly deep. Strong in mixes: for 'a hint of red', think 1–5%.",
    source:
      "https://www.dickblick.com/items/grumbacher-academy-acrylics-grumbacher-red-90-ml-tube/",
  },
];

export type StudioSurface = { id: string; name: string; notes: string; source?: string };

export const STUDIO_SURFACES: readonly StudioSurface[] = [
  {
    id: "canson-xl-mixed-media-14x17",
    name: "Canson XL Mix Media paper, 14 × 17 in",
    notes:
      "98 lb (160 gsm), one vellum side and one smooth side, acid-free, rated for acrylic. Light for acrylic: heavy water or thick wet layers make it cockle. Tape all four edges to a board, keep layers moderately thin, let each layer dry flat, and do not scrub — the surface pills.",
    source: "https://www.jerrysartarama.com/canson-xl-mixed-media-pads",
  },
  {
    id: "strathmore-400-acrylic-8x10",
    name: "Strathmore 400 Series Acrylic paper, 8 × 10 in, linen finish",
    notes:
      "246 lb (400 gsm), cream-coloured, toothy linen finish made for acrylic; heavy enough to resist buckling. The cream tone warms thin passages and the tooth breaks up dry-brushed or scumbled paint into broken colour — useful for atmospheric texture.",
    source: "https://www.dickblick.com/products/strathmore-400-series-acrylic-paper/",
  },
];

export const STUDIO_TOOLS: readonly { id: string; name: string; notes: string }[] = [
  {
    id: "palette-knife",
    name: "Palette knife",
    notes:
      "Mixes clean, consistent batches (scrape, fold, press — better than brushing paint together). Painting with it: flat planes and crisp edges with the side of the blade, scraped thin veils, dragged broken colour over a dry darker layer, impasto, sgraffito with the tip.",
  },
  {
    id: "felt-head-brush",
    name: "Felt-head brush, about 1/3 in (8 mm) wide",
    notes:
      "Soft, absorbent, flat-edged felt tip (the user's description; treat the exact construction as unknown). Holds fluid paint and lays smooth, even passages and soft gradients; good for blending broad areas and glazes. Not for thick paint or impasto. Rinse before acrylic dries in the felt.",
  },
  {
    id: "round-small",
    name: "Small round brush",
    notes: "Details, small figures, soft-edged accents, edge clean-up.",
  },
  {
    id: "round-smaller",
    name: "Smaller round brush",
    notes: "Finest marks: tiny highlights, birds, fine flares and rim light, signature.",
  },
];

export type MixPart = { paint: StudioPaintId; percent: number };

export type MixRecipe = {
  id: string;
  name: string;
  parts: readonly MixPart[];
  /** How to read and correct the test swatch. */
  adjust: string;
};

/**
 * Starting ratios by volume of wet paint, before water or medium; percentages sum to 100. They
 * are reasoned from the pigments above, not lab measurements — the assistant says so once and
 * then gives the numbers plainly, with how to correct a test swatch.
 */
export const MIX_RECIPES: readonly MixRecipe[] = [
  {
    id: "neutral-near-black",
    name: "Neutral near-black (eclipse disk, deepest darks)",
    parts: [
      { paint: "raw-umber", percent: 62 },
      { paint: "ultramarine-blue", percent: 33 },
      { paint: "quinacridone-magenta", percent: 4 },
      { paint: "phthalo-green", percent: 1 },
    ],
    adjust:
      "Greenish → a touch more magenta. Bluish → more umber. Brownish → more ultramarine. Check the cast with a speck mixed into white on the side, never by lightening the main pile.",
  },
  {
    id: "deep-chromatic-black",
    name: "Deep chromatic black (richest, most transparent dark)",
    parts: [
      { paint: "quinacridone-magenta", percent: 62 },
      { paint: "phthalo-green", percent: 38 },
    ],
    adjust:
      "Phthalo overpowers quickly — add it to the magenta, not the other way round. Green cast → more magenta; purple cast → a speck more phthalo. Add raw umber to make it more opaque.",
  },
  {
    id: "warm-umber-black",
    name: "Warm brown-black",
    parts: [
      { paint: "raw-umber", percent: 80 },
      { paint: "ultramarine-blue", percent: 15 },
      { paint: "grumbacher-red", percent: 5 },
    ],
    adjust: "Too red → more umber. Too cool → another 2–3% red.",
  },
  {
    id: "umber-value-dark",
    name: "Umber dark (one step up from the darkest)",
    parts: [
      { paint: "raw-umber", percent: 88 },
      { paint: "titanium-white", percent: 12 },
    ],
    adjust:
      "White is strong: lighten in small steps. Umber-and-white greys lean cool and slightly green.",
  },
  {
    id: "umber-value-mid",
    name: "Umber mid-tone grey-brown",
    parts: [
      { paint: "raw-umber", percent: 55 },
      { paint: "titanium-white", percent: 45 },
    ],
    adjust: "Warm it with 1–2% Grumbacher Red; cool it with 1–2% ultramarine.",
  },
  {
    id: "umber-value-light",
    name: "Light umber grey",
    parts: [
      { paint: "titanium-white", percent: 80 },
      { paint: "raw-umber", percent: 20 },
    ],
    adjust: "Chalky or dead → glaze it later rather than adding more white now.",
  },
  {
    id: "atmosphere-teal-grey",
    name: "Muted teal-grey atmosphere (like The Road to Fire's sky)",
    parts: [
      { paint: "titanium-white", percent: 50 },
      { paint: "raw-umber", percent: 40 },
      { paint: "ultramarine-blue", percent: 8 },
      { paint: "phthalo-green", percent: 2 },
    ],
    adjust: "Too green → more ultramarine or a speck of magenta. Too bright → more umber.",
  },
  {
    id: "slate-violet-shadow",
    name: "Slate-violet shadow plane",
    parts: [
      { paint: "raw-umber", percent: 50 },
      { paint: "ultramarine-blue", percent: 25 },
      { paint: "titanium-white", percent: 20 },
      { paint: "quinacridone-magenta", percent: 5 },
    ],
    adjust:
      "Too purple → more umber. Needs more air → scumble a thin veil of the teal-grey over it once dry.",
  },
  {
    id: "corona-red",
    name: "Eclipse rim red (the hint of Grumbacher Red)",
    parts: [
      { paint: "grumbacher-red", percent: 85 },
      { paint: "titanium-white", percent: 10 },
      { paint: "cadmium-yellow", percent: 5 },
    ],
    adjust:
      "Pinker, like a real chromosphere → swap the yellow for magenta. Hotter → more yellow. Use it as small accents on the rim, not a full ring.",
  },
  {
    id: "hot-rim-light",
    name: "Hot rim highlight",
    parts: [
      { paint: "titanium-white", percent: 85 },
      { paint: "cadmium-yellow", percent: 10 },
      { paint: "grumbacher-red", percent: 5 },
    ],
    adjust: "Place last and small, wet-on-dry, beside the red so both stay clean.",
  },
  {
    id: "pale-lit-face",
    name: "Pale lit face (cool off-white for lit stone or haze)",
    parts: [
      { paint: "titanium-white", percent: 90 },
      { paint: "raw-umber", percent: 7 },
      { paint: "ultramarine-blue", percent: 2 },
      { paint: "quinacridone-magenta", percent: 1 },
    ],
    adjust:
      "Drag it thinly with the knife over a dry darker layer so the dark shows through in breaks.",
  },
  {
    id: "warm-brown",
    name: "Warm sienna-like brown (no burnt sienna on this palette)",
    parts: [
      { paint: "raw-umber", percent: 60 },
      { paint: "grumbacher-red", percent: 30 },
      { paint: "cadmium-yellow", percent: 10 },
    ],
    adjust: "Duller → more umber; glowing → more red and yellow.",
  },
  {
    id: "orange",
    name: "Orange",
    parts: [
      { paint: "cadmium-yellow", percent: 70 },
      { paint: "grumbacher-red", percent: 30 },
    ],
    adjust: "The red is strong; add it to the yellow a little at a time.",
  },
  {
    id: "clean-violet",
    name: "Clean violet",
    parts: [
      { paint: "quinacridone-magenta", percent: 55 },
      { paint: "ultramarine-blue", percent: 45 },
    ],
    adjust: "Grumbacher Red instead of magenta gives a duller, browner purple.",
  },
  {
    id: "leaf-green",
    name: "Mid green",
    parts: [
      { paint: "cadmium-yellow", percent: 88 },
      { paint: "phthalo-green", percent: 12 },
    ],
    adjust: "Muted, natural green → add 5–10% raw umber or a touch of red.",
  },
];

export function studioPaintName(id: StudioPaintId): string {
  return STUDIO_PAINTS.find((paint) => paint.id === id)?.name.replace(/ \(.*\)$/, "") ?? id;
}

/** "62% raw umber, 33% ultramarine blue, …" in the order given. */
export function formatMixParts(parts: readonly MixPart[]): string {
  return parts
    .map((part) => `${part.percent}% ${studioPaintName(part.paint).toLowerCase()}`)
    .join(", ");
}

/** Same-day shopping note, configured per deployment so a neighbourhood never lands in git. */
export function studioLocalSupplyNote(): string | null {
  const note = process.env.PERSONA_STUDIO_LOCAL_SUPPLY?.trim();

  return note ? note.slice(0, 600) : null;
}
