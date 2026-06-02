"use client";

import { defaultAxisValuesForFamily, type FamilyAxisValues, type FontFamilyId } from "./font-axes";

export type HeadingToken = {
  sizeRem: number;
  lineHeight: number;
  trackingEm: number;
  weight: number;
};

export type HeadingScale = {
  h1: HeadingToken;
  h2: HeadingToken;
  h3: HeadingToken;
  body: HeadingToken;
  overline: HeadingToken;
};

export type GlassFontsBaselineState = {
  version: 1;
  draftFamily: FontFamilyId;
  lockedFamily: FontFamilyId;
  draftAxes: Record<FontFamilyId, FamilyAxisValues>;
  lockedAxes: Record<FontFamilyId, FamilyAxisValues>;
  draftHeadingScale: HeadingScale;
  lockedHeadingScale: HeadingScale;
  updatedAt: string;
};

export const GLASS_FONTS_BASELINE_STORAGE_KEY = "organic-llm:glass-fonts-baseline";

export const DEFAULT_HEADING_SCALE: HeadingScale = {
  h1: { sizeRem: 3, lineHeight: 1, trackingEm: -0.045, weight: 300 },
  h2: { sizeRem: 2.25, lineHeight: 1.04, trackingEm: -0.035, weight: 320 },
  h3: { sizeRem: 1.5, lineHeight: 1.1, trackingEm: -0.018, weight: 350 },
  body: { sizeRem: 1, lineHeight: 1.72, trackingEm: 0, weight: 400 },
  overline: { sizeRem: 0.7, lineHeight: 1.3, trackingEm: 0.22, weight: 500 },
};

export function createDefaultGlassFontsBaselineState(): GlassFontsBaselineState {
  const draftFamily: FontFamilyId = "commissioner";
  const draftAxes: Record<FontFamilyId, FamilyAxisValues> = {
    satoshi: defaultAxisValuesForFamily("satoshi"),
    inter: defaultAxisValuesForFamily("inter"),
    commissioner: defaultAxisValuesForFamily("commissioner"),
  };

  return {
    version: 1,
    draftFamily,
    lockedFamily: draftFamily,
    draftAxes,
    lockedAxes: structuredClone(draftAxes),
    draftHeadingScale: structuredClone(DEFAULT_HEADING_SCALE),
    lockedHeadingScale: structuredClone(DEFAULT_HEADING_SCALE),
    updatedAt: new Date().toISOString(),
  };
}

export function loadGlassFontsBaselineState(): GlassFontsBaselineState {
  if (typeof window === "undefined") return createDefaultGlassFontsBaselineState();

  try {
    const raw = window.localStorage.getItem(GLASS_FONTS_BASELINE_STORAGE_KEY);

    if (!raw) return createDefaultGlassFontsBaselineState();
    const parsed = JSON.parse(raw) as Partial<GlassFontsBaselineState>;

    if (parsed?.version !== 1) return createDefaultGlassFontsBaselineState();

    return {
      ...createDefaultGlassFontsBaselineState(),
      ...parsed,
      draftAxes: {
        ...createDefaultGlassFontsBaselineState().draftAxes,
        ...(parsed.draftAxes ?? {}),
      },
      lockedAxes: {
        ...createDefaultGlassFontsBaselineState().lockedAxes,
        ...(parsed.lockedAxes ?? {}),
      },
      draftHeadingScale: {
        ...DEFAULT_HEADING_SCALE,
        ...(parsed.draftHeadingScale ?? {}),
      },
      lockedHeadingScale: {
        ...DEFAULT_HEADING_SCALE,
        ...(parsed.lockedHeadingScale ?? {}),
      },
    };
  } catch {
    return createDefaultGlassFontsBaselineState();
  }
}

export function saveGlassFontsBaselineState(state: GlassFontsBaselineState): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(GLASS_FONTS_BASELINE_STORAGE_KEY, JSON.stringify(state));
}
