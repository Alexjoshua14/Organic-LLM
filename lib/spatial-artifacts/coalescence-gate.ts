import { getSettings } from "@/lib/user-settings";

/** Client: read from localStorage cache. */
export function isSpatialArtifactsEnabled(): boolean {
  return getSettings().coalescenceMode === true;
}

/** Server: trust authenticated client flag (same pattern as zeroDataRetention on /api/chat). */
export function isSpatialArtifactsEnabledFromRequest(
  coalescenceMode: boolean | undefined
): boolean {
  return coalescenceMode === true;
}
