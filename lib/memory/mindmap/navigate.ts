import {
  MEMORY_MINDMAP_OTHER_LABEL,
  MEMORY_MINDMAP_ROOT_LABEL,
  type MemorySector,
  type MemoryTrace,
} from "./types";
import { clusterMemoriesIntoSectors, tokensFromLabel } from "./cluster";

export type MindmapFocus = {
  label: string;
  /** `null` means the full corpus (root). */
  memoryIds: string[] | null;
  ignoreTokens: string[];
};

export const MEMORY_MINDMAP_ROOT_FOCUS: MindmapFocus = {
  label: MEMORY_MINDMAP_ROOT_LABEL,
  memoryIds: null,
  ignoreTokens: [],
};

function sameIdSet(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return false;
  const other = new Set(b);

  return a.every((id) => other.has(id));
}

function tracesForFocus(traces: MemoryTrace[], focus: MindmapFocus): MemoryTrace[] {
  if (focus.memoryIds === null) return traces;
  const allowed = new Set(focus.memoryIds);

  return traces.filter((trace) => allowed.has(trace.id));
}

function slugPrefix(label: string): string {
  return (
    label
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "layer"
  );
}

function explodeLeaves(subset: MemoryTrace[], focus: MindmapFocus): MemorySector[] {
  const ignore = new Set(focus.ignoreTokens.map((t) => t.toLowerCase()));
  const used = new Set<string>();
  const prefix = slugPrefix(focus.label);
  const sectors: MemorySector[] = [];

  for (const trace of subset) {
    const clustered = clusterMemoriesIntoSectors([trace], {
      ignoreTokens: [...ignore],
      treatTopicsAsText: true,
      idPrefix: `${prefix}-leaf`,
    });
    const leaf = clustered[0];
    const label = leaf?.label && leaf.label !== MEMORY_MINDMAP_OTHER_LABEL ? leaf.label : "Trace";
    let id = `sector:${prefix}:${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
    let n = 2;

    while (used.has(id)) {
      id = `sector:${prefix}:leaf-${n}`;
      n += 1;
    }
    used.add(id);
    sectors.push({ id, label, memoryIds: [trace.id] });
  }

  return sectors;
}

/**
 * Sectors arranged around the current focus (center node).
 * Below root, parent tokens are ignored so the layer splits instead of repeating.
 */
export function childSectorsForFocus(traces: MemoryTrace[], focus: MindmapFocus): MemorySector[] {
  const subset = tracesForFocus(traces, focus);

  if (subset.length === 0) return [];

  const isRoot = focus.memoryIds === null;
  const clustered = clusterMemoriesIntoSectors(subset, {
    ignoreTokens: focus.ignoreTokens,
    treatTopicsAsText: !isRoot,
    idPrefix: isRoot ? undefined : slugPrefix(focus.label),
  });

  if (subset.length === 1) return clustered;

  const collapsedIntoParent =
    clustered.length <= 1 &&
    (clustered[0] === undefined ||
      clustered[0].label.toLowerCase() === focus.label.toLowerCase() ||
      sameIdSet(
        clustered[0].memoryIds,
        subset.map((t) => t.id)
      ));

  if (collapsedIntoParent) return explodeLeaves(subset, focus);

  return clustered;
}

export function focusFromSector(parent: MindmapFocus, sector: MemorySector): MindmapFocus {
  return {
    label: sector.label,
    memoryIds: sector.memoryIds,
    ignoreTokens: [...parent.ignoreTokens, ...tokensFromLabel(sector.label)],
  };
}

export function canDrillIntoSector(
  traces: MemoryTrace[],
  parent: MindmapFocus,
  sector: MemorySector
): boolean {
  if (sector.memoryIds.length <= 1) return false;

  const kids = childSectorsForFocus(traces, focusFromSector(parent, sector));

  return kids.length > 0;
}
