import { GoodNewsCategory } from "@/lib/schemas/good-news";

type CategoryMeta = {
  label: string;
  /** Tailwind classes for the category badge (text + subtle tinted background). */
  badgeClass: string;
};

export const CATEGORY_META: Record<GoodNewsCategory, CategoryMeta> = {
  health: {
    label: "Health",
    badgeClass: "text-rose-700 bg-rose-500/10 dark:text-rose-300",
  },
  climate: {
    label: "Climate",
    badgeClass: "text-emerald-700 bg-emerald-500/10 dark:text-emerald-300",
  },
  conservation: {
    label: "Conservation",
    badgeClass: "text-green-700 bg-green-500/10 dark:text-green-300",
  },
  conflict_resolution: {
    label: "Peace",
    badgeClass: "text-sky-700 bg-sky-500/10 dark:text-sky-300",
  },
  science: {
    label: "Science",
    badgeClass: "text-indigo-700 bg-indigo-500/10 dark:text-indigo-300",
  },
  technology: {
    label: "Technology",
    badgeClass: "text-violet-700 bg-violet-500/10 dark:text-violet-300",
  },
  social_progress: {
    label: "Social Progress",
    badgeClass: "text-amber-700 bg-amber-500/10 dark:text-amber-300",
  },
  humanitarian: {
    label: "Humanitarian",
    badgeClass: "text-teal-700 bg-teal-500/10 dark:text-teal-300",
  },
  other: {
    label: "Good News",
    badgeClass: "text-foreground bg-foreground/10",
  },
};

/** Build a favicon URL for a domain (Google's public favicon service). */
export function faviconFor(domain: string): string {
  return `https://www.google.com/s2/favicons?domain=${domain}&sz=32`;
}

/** Human-friendly date label, e.g. "May 28, 2026". Falls back to the raw value. */
export function formatDate(value?: string): string | null {
  if (!value) return null;

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return null;

  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}
