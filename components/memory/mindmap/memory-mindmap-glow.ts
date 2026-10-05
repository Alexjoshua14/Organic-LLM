import type { MemoryTouchKind } from "@/lib/memory/mindmap";

export type MindmapGlowPaint = {
  label: string;
  stroke: string;
  fill: string;
  glow: string;
};

/** Quiet persistent aura for sectors currently in the model’s context. */
export const IN_CONTEXT_GLOW: MindmapGlowPaint = {
  label: "In context",
  stroke: "rgba(103, 232, 249, 0.72)",
  fill: "rgba(103, 232, 249, 0.14)",
  glow: "rgba(103, 232, 249, 0.38)",
};

export const IDLE_NODE_GLOW: MindmapGlowPaint = {
  label: "Idle",
  stroke: "rgba(255, 255, 255, 0.22)",
  fill: "rgba(255, 255, 255, 0.06)",
  glow: "rgba(255, 255, 255, 0.08)",
};

/**
 * Operation colors — cyan access (matches Remy retrieved cards), emerald create
 * (matches added cards), amber update, rose delete.
 */
export const MEMORY_TOUCH_GLOW: Record<MemoryTouchKind, MindmapGlowPaint> = {
  accessed: {
    label: "Accessed",
    stroke: "rgba(34, 211, 238, 0.95)",
    fill: "rgba(34, 211, 238, 0.22)",
    glow: "rgba(34, 211, 238, 0.58)",
  },
  created: {
    label: "Created",
    stroke: "rgba(52, 211, 153, 0.95)",
    fill: "rgba(52, 211, 153, 0.22)",
    glow: "rgba(52, 211, 153, 0.55)",
  },
  updated: {
    label: "Updated",
    stroke: "rgba(251, 191, 36, 0.95)",
    fill: "rgba(251, 191, 36, 0.22)",
    glow: "rgba(251, 191, 36, 0.55)",
  },
  deleted: {
    label: "Deleted",
    stroke: "rgba(251, 113, 133, 0.95)",
    fill: "rgba(251, 113, 133, 0.2)",
    glow: "rgba(251, 113, 133, 0.5)",
  },
};

export const MEMORY_TOUCH_LINGER_MS = 2800;
