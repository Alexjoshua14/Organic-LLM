/**
 * Cache key for a release-notes comparison.
 * Keys on git SHAs only — version labels are not part of the key.
 * If history is rewritten and SHAs change, that is a deliberate cache miss.
 */
export type ReleaseNotesShaPair = {
  fromSha: string;
  toSha: string;
};

/** Normalize to full-length SHAs when possible; otherwise trim and lowercase. */
export function normalizeSha(sha: string): string {
  return sha.trim().toLowerCase();
}

export function releaseNotesCacheKey(pair: ReleaseNotesShaPair): string {
  const fromSha = normalizeSha(pair.fromSha);
  const toSha = normalizeSha(pair.toSha);

  return `${fromSha}:${toSha}`;
}

export function parseReleaseNotesCacheKey(key: string): ReleaseNotesShaPair | null {
  const sep = key.indexOf(":");

  if (sep <= 0 || sep === key.length - 1) return null;

  const fromSha = key.slice(0, sep);
  const toSha = key.slice(sep + 1);

  if (!fromSha || !toSha || fromSha.includes(":") || !toSha) return null;

  return { fromSha, toSha };
}
