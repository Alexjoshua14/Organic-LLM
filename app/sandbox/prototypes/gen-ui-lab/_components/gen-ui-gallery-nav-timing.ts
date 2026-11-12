/**
 * Gallery scroll dots (`GenUiGalleryNav`). Each row is a fixed-width button, so the dot can slide
 * left and its label can appear without the pointer leaving the target. The label itself reuses
 * `ProcessingTextBurn` (see docs/design/motion-and-text-timing.md); only the dot is tuned here.
 */

/** Row width (px): the dot rests centred in it, the open label fills the room to its right. */
export const GALLERY_NAV_ROW_WIDTH_PX = 96;

/** Row height (px). Keeps the 20px hit target the dots always had. */
export const GALLERY_NAV_ROW_HEIGHT_PX = 20;

/** Dot diameter (px). */
export const GALLERY_NAV_DOT_SIZE_PX = 8;

/** Where the dot's centre sits from the row's left edge once the label is open (px). */
export const GALLERY_NAV_DOT_OPEN_CENTER_PX = 10;

/** Gap between the open dot and its label (px). */
export const GALLERY_NAV_LABEL_GAP_PX = 8;

/** Dot slide: label entrance-length, so the dot lands as the first glyphs arrive (seconds). */
export const GALLERY_NAV_DOT_MOVE_S = 0.25;

/** Dot slide back and label fade-out: exits are faster than entrances (seconds). */
export const GALLERY_NAV_EXIT_S = 0.15;

/** Dot size multiplier while hovered or focused. */
export const GALLERY_NAV_DOT_HOVER_SCALE = 1.2;

/** Same ease the dots already used (ease-out-quint-like). */
export const GALLERY_NAV_EASE = [0.23, 1, 0.32, 1] as const;

/** How far left the dot travels from its resting centre (px). */
export const GALLERY_NAV_DOT_SHIFT_PX =
  GALLERY_NAV_ROW_WIDTH_PX / 2 - GALLERY_NAV_DOT_OPEN_CENTER_PX;

/** Label's left edge from the row's left edge (px). */
export const GALLERY_NAV_LABEL_LEFT_PX =
  GALLERY_NAV_DOT_OPEN_CENTER_PX + GALLERY_NAV_DOT_SIZE_PX / 2 + GALLERY_NAV_LABEL_GAP_PX;
