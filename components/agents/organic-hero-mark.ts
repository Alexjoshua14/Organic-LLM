/**
 * Organic agent mark at hero size (Speak, Stage) (`OrganicActivityMark`). The mark was tuned for a 40px
 * chip; blown up to ~13rem with a proportional blur, its dots left about a quarter of their ink
 * after blurring, and the default idle cover (50% tint, 115% brightness) washed that to roughly
 * 11% contrast. The tile then read as empty glass with the page showing through.
 *
 * Speak and Stage keep the blur as is and instead gives the dots more weight before it, and lets the
 * cover lighten less. Dot weight 1.8 with a 10–15% cover (inkier pass; judged by eye, not yet rendered). Material values are
 * hero overrides (`glassByState`); the shared defaults in `activity-mark-glass.ts` stay put.
 */
export const ORGANIC_HERO_DOT_WEIGHT = 1.8;
/** Frosted underlay (px) that blurs the page behind the hero agent mark. */
export const ORGANIC_HERO_UNDERLAY_BLUR = 28;
export const ORGANIC_HERO_GLASS = {
  idle: { opacity: 0.12, brightness: 1 },
  working: { opacity: 0.12, brightness: 1.1 },
  waiting: { opacity: 0.15, brightness: 1 },
  blocked: { opacity: 0.1, brightness: 1.1 },
  complete: { opacity: 0.12, brightness: 1 },
} as const;

/** Props that make `OrganicActivityMark` read as the hero mark, so Speak and Stage stay identical. */
export const ORGANIC_HERO_MARK = {
  relativeBlur: true,
  dotWeight: ORGANIC_HERO_DOT_WEIGHT,
  underlayBlur: ORGANIC_HERO_UNDERLAY_BLUR,
  glassByState: ORGANIC_HERO_GLASS,
} as const;
