import type { PrototypeEntry } from "@/app/sandbox/prototypes/_config/prototypes";

export type RankedPrototype = PrototypeEntry & {
  href: string;
  score: number;
  reasons: string[];
};

const DAY_MS = 24 * 60 * 60 * 1000;

function parseDateValue(date?: string): number | null {
  if (!date) return null;

  const value = Date.parse(date);

  return Number.isNaN(value) ? null : value;
}

function recencyScore(date: number | null, latestDate: number | null, maxScore: number): number {
  if (date === null || latestDate === null) return 0;

  const daysOld = Math.max(0, Math.round((latestDate - date) / DAY_MS));

  return Math.max(0, maxScore - daysOld);
}

function buildReasons(entry: PrototypeEntry, latestUpdatedAt: number | null): string[] {
  const ranking = entry.ranking ?? {};
  const reasons: string[] = [];
  const updatedAt = parseDateValue(ranking.updatedAt);

  if ((ranking.importance ?? 0) >= 9) reasons.push("High importance");
  if ((ranking.frequency ?? 0) >= 8) reasons.push("Frequently used");
  if (updatedAt !== null && latestUpdatedAt !== null && latestUpdatedAt - updatedAt <= DAY_MS) {
    reasons.push("Recently updated");
  }
  if (reasons.length === 0) reasons.push("Available prototype");

  return reasons.slice(0, 2);
}

export function rankPrototypes(
  entries: PrototypeEntry[],
  getHref: (slug: string) => string
): RankedPrototype[] {
  const latestUpdatedAt = entries.reduce<number | null>((latest, entry) => {
    const updatedAt = parseDateValue(entry.ranking?.updatedAt);

    if (updatedAt === null) return latest;

    return latest === null ? updatedAt : Math.max(latest, updatedAt);
  }, null);
  const latestCreatedAt = entries.reduce<number | null>((latest, entry) => {
    const createdAt = parseDateValue(entry.ranking?.createdAt);

    if (createdAt === null) return latest;

    return latest === null ? createdAt : Math.max(latest, createdAt);
  }, null);

  return entries
    .map((entry) => {
      const ranking = entry.ranking ?? {};
      const importance = ranking.importance ?? 0;
      const frequency = ranking.frequency ?? 0;
      const updatedAt = parseDateValue(ranking.updatedAt);
      const createdAt = parseDateValue(ranking.createdAt);
      const score =
        importance * 100 +
        frequency * 12 +
        recencyScore(updatedAt, latestUpdatedAt, 30) +
        recencyScore(createdAt, latestCreatedAt, 10);

      return {
        ...entry,
        href: getHref(entry.slug),
        score,
        reasons: buildReasons(entry, latestUpdatedAt),
      };
    })
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;

      return a.title.localeCompare(b.title);
    });
}
