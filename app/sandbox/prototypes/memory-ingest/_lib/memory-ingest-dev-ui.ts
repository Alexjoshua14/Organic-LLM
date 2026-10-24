/**
 * Build-time opt-in for prototype debug UI when not in `next dev`
 * (e.g. `next build` + `next start` sets NODE_ENV=production).
 * Set in `.env` before `next build` / `next start`.
 */
export function isMemoryIngestDevUiPublicFlag(): boolean {
  const v = process.env.NEXT_PUBLIC_MEMORY_INGEST_DEV_UI;

  return v === "1" || v === "true" || v === "yes";
}

/** URL query `?memoryIngestDev=1` enables dev UI at runtime without rebuilding. */
export function readMemoryIngestDevUiFromSearch(search: string): boolean {
  try {
    const q = new URLSearchParams(search);

    return q.get("memoryIngestDev") === "1" || q.get("memoryIngestDev") === "true";
  } catch {
    return false;
  }
}
