export const DEV_DOC_CATEGORIES = ["platform", "noesis", "composer", "onboarding"] as const;

export type DevDocCategory = (typeof DEV_DOC_CATEGORIES)[number];

export type DevDocEntry = {
  slug: string;
  title: string;
  description: string;
  category: DevDocCategory;
  /** Markdown file under `content/dev-docs/`. */
  file: string;
  updated: string;
};

export const DEV_DOC_CATEGORY_LABELS: Record<DevDocCategory, string> = {
  platform: "Platform",
  noesis: "Noesis",
  composer: "Composer",
  onboarding: "Onboarding",
};

export const DEV_DOCS: DevDocEntry[] = [
  {
    slug: "overview",
    title: "Developer documentation",
    description:
      "How this site relates to the repo, who it is for, and where to find architecture notes.",
    category: "platform",
    file: "overview.md",
    updated: "2026-06-29",
  },
  {
    slug: "noesis",
    title: "Noesis (topic explore)",
    description:
      "Assist reply, morph composer, scroll persistence, thread title chrome, APIs, and key files.",
    category: "noesis",
    file: "noesis.md",
    updated: "2026-06-29",
  },
  {
    slug: "composer-preferences",
    title: "Composer preferences & Auto model",
    description:
      "Search/Memory defaults, localStorage contract, multi-window behaviour, and auto-model routing.",
    category: "composer",
    file: "composer-preferences.md",
    updated: "2026-06-29",
  },
  {
    slug: "feature-hints",
    title: "Feature tips",
    description:
      "Automatic tips: anchoring, pacing, dismissal rules, storage, and how to add or retire one.",
    category: "onboarding",
    file: "feature-hints.md",
    updated: "2026-11-18",
  },
  {
    slug: "nux-overview",
    title: "New user experience (NUX)",
    description: "Welcome card, the Guide, first steps, feature tips, and replaying onboarding.",
    category: "onboarding",
    file: "nux-overview.md",
    updated: "2026-11-18",
  },
];

export function getDevDocBySlug(slug: string): DevDocEntry | undefined {
  return DEV_DOCS.find((doc) => doc.slug === slug);
}
