import type { GenUIBlockType } from "@/lib/schemas/gen-ui";
import type { SpatialArtifactFilter } from "@/lib/schemas/spatial-artifact";

export type SpatialZone = "plans" | "bookshelf" | "audio";

export function primaryZoneForBlockType(type: GenUIBlockType): SpatialZone {
  switch (type) {
    case "plan-timeline":
      return "plans";
    case "audio-snippet":
      return "audio";
    case "answer-card":
    case "decision-matrix":
    default:
      return "bookshelf";
  }
}

export function visibleZonesForFilter(filter: SpatialArtifactFilter): SpatialZone[] | "all" {
  switch (filter) {
    case "plans":
      return ["plans"];
    case "audio":
      return ["audio"];
    case "guides":
      return ["bookshelf"];
    case "pinned":
    case "all":
      return "all";
  }
}

export function artifactMatchesFilter(
  blockType: GenUIBlockType,
  pinned: boolean,
  filter: SpatialArtifactFilter
): boolean {
  switch (filter) {
    case "all":
      return true;
    case "pinned":
      return pinned;
    case "plans":
      return blockType === "plan-timeline";
    case "audio":
      return blockType === "audio-snippet";
    case "guides":
      return blockType === "answer-card" || blockType === "decision-matrix";
  }
}

export type ArtifactSlotRole =
  | "plan-condensed"
  | "plan-expanded"
  | "bookshelf-spine"
  | "bookshelf-open"
  | "audio-tile";

export function slotKey(role: ArtifactSlotRole, artifactId: string): string {
  return `${role}:${artifactId}`;
}
