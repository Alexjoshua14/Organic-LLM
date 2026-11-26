import type { MeasureTone } from "@/lib/schemas/gen-ui";

/** Filled tones shared by measure spans and profile-map domain orbs. */
export const toneClass: Record<MeasureTone, string> = {
  accent: "bg-accent",
  action: "bg-accent-warm",
  muted: "bg-muted-foreground/35",
};

/**
 * Glass tones for thin (condensed) spans: a translucent tinted body with an inset rim of the same
 * hue, the chip lens of `glass()` at bar scale. Backdrop blur is left out on purpose: a hairline
 * bar over a flat track has nothing behind it to blur.
 */
export const toneGlassClass: Record<MeasureTone, string> = {
  accent: "bg-accent/30 ring-1 ring-inset ring-accent/70",
  action: "bg-accent-warm/30 ring-1 ring-inset ring-accent-warm/70",
  muted: "bg-muted-foreground/15 ring-1 ring-inset ring-muted-foreground/40",
};

/** SVG `fill` / `stroke` via theme CSS variables (no hex literals). */
export const toneFill: Record<MeasureTone, string> = {
  accent: "var(--color-accent)",
  action: "var(--color-accent-warm)",
  muted: "var(--color-muted-foreground)",
};
