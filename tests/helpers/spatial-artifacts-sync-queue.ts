/** Reset in-process artifact sync queue between tests. */
export function resetSpatialArtifactSyncQueue(): void {
  const g = globalThis as typeof globalThis & {
    __spatialArtifactSyncQueue?: { pending: unknown[]; ids: Set<string> };
  };

  g.__spatialArtifactSyncQueue = { pending: [], ids: new Set() };
}
