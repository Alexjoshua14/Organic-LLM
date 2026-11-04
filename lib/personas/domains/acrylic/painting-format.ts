import type { PaintingState } from "./painting-state";

import { formatPaintingMetrics } from "./painting-metrics";

/** Compact, prompt-ready text of the painting state. */
export function formatPaintingState(state: PaintingState, now = new Date()): string {
  const minutes = Math.max(0, Math.round((now.getTime() - Date.parse(state.updatedAt)) / 60_000));
  const age =
    minutes < 1
      ? "just now"
      : minutes < 90
        ? `${minutes} min ago`
        : `${Math.round(minutes / 60)} h ago`;
  const lines = [
    `From photo #${state.revision} (${age}): ${state.summary}`,
    state.composition ? `Composition: ${state.composition}` : "",
    state.regions.length
      ? `Regions:\n${state.regions.map((region) => `- ${region.name} (${region.where}; ${region.value}; ${region.edges} edges): ${region.description}${region.colors.length ? ` Colours: ${region.colors.join(", ")}.` : ""}`).join("\n")}`
      : "",
    state.techniques.length ? `Visible handling: ${state.techniques.join("; ")}` : "",
    formatPaintingMetrics(state.metrics),
    state.latestChanges.length
      ? `Changed since the previous photo: ${state.latestChanges.join("; ")}`
      : "",
    state.uncertainties.length ? `Uncertain: ${state.uncertainties.join("; ")}` : "",
  ];

  return lines.filter(Boolean).join("\n");
}
