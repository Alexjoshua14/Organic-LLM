import type { MeasureTone } from "@/lib/schemas/gen-ui";

/** Filled tones shared by measure spans and profile-map domain orbs. */
export const toneClass: Record<MeasureTone, string> = {
  accent: "bg-accent",
  action: "bg-accent-warm",
  muted: "bg-muted-foreground/35",
};

/** SVG `fill` / `stroke` via theme CSS variables (no hex literals). */
export const toneFill: Record<MeasureTone, string> = {
  accent: "var(--color-accent)",
  action: "var(--color-accent-warm)",
  muted: "var(--color-muted-foreground)",
};
