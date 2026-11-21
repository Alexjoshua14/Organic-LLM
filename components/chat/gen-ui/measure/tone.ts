import type { MeasureTone } from "@/lib/schemas/gen-ui";

/** Filled tones shared by measure spans and profile-map domain orbs. */
export const toneClass: Record<MeasureTone, string> = {
  accent: "bg-accent",
  action: "bg-accent-warm",
  muted: "bg-muted-foreground/35",
};
