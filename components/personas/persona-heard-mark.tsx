"use client";

import { PersonaSpark } from "./persona-spark";

/**
 * The receipt under a user message the persona chose not to answer: proof it was heard, without
 * a reply. Quiet by design — a small mark, no bubble.
 */
export function PersonaHeardMark({ label, pulseKey }: { label: string; pulseKey?: number | null }) {
  return (
    <div
      aria-live="polite"
      className="-mt-6 flex items-center justify-end gap-1.5 pr-1 text-2xs text-muted-foreground"
      role="status"
    >
      <PersonaSpark pulseKey={pulseKey} size={12} state="idle" />
      <span>{label}</span>
    </div>
  );
}
