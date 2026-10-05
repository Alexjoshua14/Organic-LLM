import {
  DEFAULT_MAX_MEMORY_MINDMAP_SECTORS,
  MEMORY_MINDMAP_OTHER_LABEL,
  type ClusterMemoriesOptions,
  type MemorySector,
  type MemoryTrace,
} from "./types";

const STOPWORDS = new Set([
  "a",
  "about",
  "after",
  "all",
  "also",
  "an",
  "and",
  "any",
  "are",
  "as",
  "at",
  "be",
  "been",
  "being",
  "but",
  "by",
  "can",
  "called",
  "did",
  "do",
  "does",
  "doing",
  "done",
  "each",
  "every",
  "for",
  "from",
  "had",
  "has",
  "have",
  "her",
  "him",
  "his",
  "how",
  "into",
  "is",
  "it",
  "its",
  "just",
  "like",
  "likes",
  "may",
  "more",
  "most",
  "named",
  "not",
  "of",
  "on",
  "or",
  "our",
  "over",
  "prefer",
  "preferred",
  "prefers",
  "really",
  "some",
  "such",
  "than",
  "that",
  "the",
  "their",
  "them",
  "then",
  "they",
  "this",
  "to",
  "used",
  "user",
  "users",
  "uses",
  "using",
  "very",
  "was",
  "were",
  "what",
  "when",
  "where",
  "which",
  "while",
  "who",
  "will",
  "with",
  "would",
  "you",
  "your",
]);

const CANONICAL_LABEL: Record<string, string> = {
  llm: "LLM",
  ui: "UI",
  npm: "npm",
  qdrant: "Qdrant",
  typescript: "TypeScript",
  javascript: "JavaScript",
};

function tokenize(text: string, ignore?: ReadonlySet<string>): string[] {
  const seen = new Set<string>();
  const tokens: string[] = [];

  for (const raw of text.toLowerCase().split(/[^a-z0-9]+/)) {
    if (raw.length < 3 || STOPWORDS.has(raw) || ignore?.has(raw) || seen.has(raw)) continue;
    seen.add(raw);
    tokens.push(raw);
  }

  return tokens;
}

export function tokensFromLabel(label: string): string[] {
  return tokenize(label);
}

function titleCaseToken(token: string): string {
  const canonical = CANONICAL_LABEL[token];

  if (canonical) return canonical;

  return token.charAt(0).toUpperCase() + token.slice(1);
}

function slugify(label: string): string {
  const slug = label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return slug.length > 0 ? slug : "sector";
}

function uniqueSectorId(label: string, used: Set<string>, prefix?: string): string {
  const base = prefix ? `sector:${prefix}:${slugify(label)}` : `sector:${slugify(label)}`;

  if (!used.has(base)) {
    used.add(base);

    return base;
  }

  let i = 2;

  while (used.has(`${base}-${i}`)) i += 1;
  const id = `${base}-${i}`;

  used.add(id);

  return id;
}

function labelFromTexts(texts: string[], ignore?: ReadonlySet<string>): string {
  const freq = new Map<string, number>();

  for (const text of texts) {
    for (const token of tokenize(text, ignore)) {
      freq.set(token, (freq.get(token) ?? 0) + 1);
    }
  }

  const ranked = [...freq.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));

  if (ranked.length === 0) return MEMORY_MINDMAP_OTHER_LABEL;

  if (texts.length === 1) {
    const ordered = tokenize(texts[0], ignore);
    const token = ordered[ordered.length - 1] ?? ordered[0];

    return token ? titleCaseToken(token) : MEMORY_MINDMAP_OTHER_LABEL;
  }

  const [first, second] = ranked;

  if (second && second[1] === first[1]) {
    const joined = texts.join(" ").toLowerCase();
    const firstAt = joined.indexOf(first[0]);
    const secondAt = joined.indexOf(second[0]);
    const ordered =
      secondAt >= 0 && (firstAt < 0 || secondAt < firstAt)
        ? [second[0], first[0]]
        : [first[0], second[0]];

    return `${titleCaseToken(ordered[0])} ${titleCaseToken(ordered[1])}`;
  }

  return titleCaseToken(first[0]);
}

function makeSector(
  label: string,
  memoryIds: string[],
  usedIds: Set<string>,
  prefix?: string
): MemorySector {
  return {
    id: uniqueSectorId(label, usedIds, prefix),
    label,
    memoryIds: [...memoryIds],
  };
}

function clusterUntagged(
  memories: MemoryTrace[],
  usedIds: Set<string>,
  ignore: ReadonlySet<string>,
  prefix?: string
): MemorySector[] {
  if (memories.length === 0) return [];

  const remaining = new Set(memories.map((m) => m.id));
  const byId = new Map(memories.map((m) => [m.id, m]));
  const tokenToIds = new Map<string, string[]>();

  for (const memory of memories) {
    for (const token of tokenize(memory.text, ignore)) {
      const ids = tokenToIds.get(token);

      if (ids) ids.push(memory.id);
      else tokenToIds.set(token, [memory.id]);
    }
  }

  const tokensByFreq = [...tokenToIds.entries()].sort(
    (a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0])
  );

  const sectors: MemorySector[] = [];

  for (const [, ids] of tokensByFreq) {
    const candidates = ids.filter((id) => remaining.has(id));

    if (candidates.length < 2) continue;

    const texts = candidates.map((id) => byId.get(id)?.text ?? "");
    const label = labelFromTexts(texts, ignore);

    sectors.push(makeSector(label, candidates, usedIds, prefix));
    for (const id of candidates) remaining.delete(id);
  }

  const leftoverIds = [...remaining];

  if (leftoverIds.length === 0) return sectors;

  const leftoverWithTokens: string[] = [];
  const leftoverEmpty: string[] = [];

  for (const id of leftoverIds) {
    const text = byId.get(id)?.text ?? "";

    if (tokenize(text, ignore).length > 0) leftoverWithTokens.push(id);
    else leftoverEmpty.push(id);
  }

  for (const id of leftoverWithTokens) {
    const text = byId.get(id)?.text ?? "";

    sectors.push(makeSector(labelFromTexts([text], ignore), [id], usedIds, prefix));
  }

  if (leftoverEmpty.length > 0) {
    const existingOther = sectors.find((s) => s.label === MEMORY_MINDMAP_OTHER_LABEL);

    if (existingOther) {
      existingOther.memoryIds.push(...leftoverEmpty);
    } else {
      sectors.push(makeSector(MEMORY_MINDMAP_OTHER_LABEL, leftoverEmpty, usedIds, prefix));
    }
  }

  return sectors;
}

function capSectors(
  sectors: MemorySector[],
  maxSectors: number,
  usedIds: Set<string>,
  prefix?: string
): MemorySector[] {
  if (sectors.length <= maxSectors) return sectors;

  const ranked = [...sectors].sort(
    (a, b) => b.memoryIds.length - a.memoryIds.length || a.label.localeCompare(b.label)
  );
  const keepCount = Math.max(1, maxSectors - 1);
  const kept = ranked.slice(0, keepCount);
  const overflowIds = ranked.slice(keepCount).flatMap((s) => s.memoryIds);
  const other = kept.find((s) => s.label === MEMORY_MINDMAP_OTHER_LABEL);

  if (other) {
    other.memoryIds.push(...overflowIds);

    return kept;
  }

  return [...kept, makeSector(MEMORY_MINDMAP_OTHER_LABEL, overflowIds, usedIds, prefix)];
}

/**
 * Groups memories into categorical sectors for the mind map.
 *
 * 1. Explicit `topic` metadata (e.g. Delphi commits) becomes a sector label.
 * 2. Remaining rows cluster on shared significant tokens from the memory text.
 * 3. Labels come from those topics/tokens — never the memory body.
 */
export function clusterMemoriesIntoSectors(
  memories: MemoryTrace[],
  options: ClusterMemoriesOptions = {}
): MemorySector[] {
  const maxSectors = options.maxSectors ?? DEFAULT_MAX_MEMORY_MINDMAP_SECTORS;
  const ignore = new Set((options.ignoreTokens ?? []).map((t) => t.toLowerCase()));
  const prefix = options.idPrefix;
  const usedIds = new Set<string>();
  const topicBuckets = new Map<string, MemoryTrace[]>();
  const untagged: MemoryTrace[] = [];

  for (const memory of memories) {
    const topic = options.treatTopicsAsText ? undefined : memory.topic?.trim();

    if (topic) {
      const key = topic.toLowerCase().replace(/\s+/g, " ");
      const bucket = topicBuckets.get(key);

      if (bucket) bucket.push(memory);
      else topicBuckets.set(key, [memory]);
    } else {
      untagged.push(memory);
    }
  }

  const sectors: MemorySector[] = [];

  for (const [key, bucket] of [...topicBuckets.entries()].sort((a, b) =>
    a[0].localeCompare(b[0])
  )) {
    const label = key
      .split(" ")
      .map((part) => titleCaseToken(part))
      .join(" ");

    sectors.push(
      makeSector(
        label,
        bucket.map((m) => m.id),
        usedIds,
        prefix
      )
    );
  }

  sectors.push(...clusterUntagged(untagged, usedIds, ignore, prefix));

  return capSectors(sectors, maxSectors, usedIds, prefix);
}

export function findSectorIdForMemory(
  sectors: MemorySector[],
  memoryId: string
): string | undefined {
  return sectors.find((sector) => sector.memoryIds.includes(memoryId))?.id;
}
