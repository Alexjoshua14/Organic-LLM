/** Surfaces in the experience rail + blog docs. */
export type ExperienceSurface = {
  id: string;
  /** URL segment under `/blog/surfaces/` */
  slug: string;
  label: string;
  description: string;
  tryHref: string;
  /** Grouped under Chat in docs: same threads and memory, tuned composer and replies. */
  chatVariant?: boolean;
  /** Unfinished: its route is admin-only, so public pages do not link to it. */
  adminOnly?: boolean;
};

export const CHAT_VARIANT_NOTE =
  "Arcadia and Noesis are chat experiences: the same threads, memory and encryption, with a composer and reply style tuned for a different job.";

export const EXPERIENCE_SURFACES: ExperienceSurface[] = [
  {
    id: "chat",
    slug: "chat",
    label: "Chat",
    description: "Main threads — search, memory, and your everyday composer.",
    tryHref: "/",
  },
  {
    id: "arcadia",
    slug: "arcadia",
    label: "Arcadia",
    description:
      "Work on several things at once: an orchestrator that delegates to subagents you can watch and talk to.",
    tryHref: "/sandbox/arcadia",
    chatVariant: true,
  },
  {
    id: "noesis",
    slug: "noesis",
    label: "Noesis",
    description: "Start and steer a conversation with sparks and suggested replies.",
    tryHref: "/sandbox/topic-explore",
    chatVariant: true,
    adminOnly: true,
  },
  {
    id: "strata",
    slug: "strata",
    label: "Strata",
    description: "Rough notes become structured sections on an editorial canvas.",
    tryHref: "/sandbox/prototypes/strata",
    adminOnly: true,
  },
  {
    id: "rabbitholes",
    slug: "rabbit-holes",
    label: "Rabbit Holes",
    description: "Branching research with cited sources.",
    tryHref: "/rabbitholes/browse",
  },
  {
    id: "ergon",
    slug: "ergon",
    label: "Ergon",
    description: "A durable, keyboard-first task list.",
    tryHref: "/ergon",
  },
  {
    id: "remy",
    slug: "remy",
    label: "Remy",
    description: "Meal prep: a weekly plan, a recipe library and a shopping list.",
    tryHref: "/remy",
  },
];

export function getExperienceSurfaceBySlug(slug: string): ExperienceSurface | undefined {
  return EXPERIENCE_SURFACES.find((s) => s.slug === slug);
}

export function getExperienceSurfaceById(id: string): ExperienceSurface | undefined {
  return EXPERIENCE_SURFACES.find((s) => s.id === id);
}

export function chatVariantSurfaces(): ExperienceSurface[] {
  return EXPERIENCE_SURFACES.filter((s) => s.chatVariant);
}

export function standaloneSurfaces(): ExperienceSurface[] {
  return EXPERIENCE_SURFACES.filter((s) => !s.chatVariant && s.id !== "chat");
}

export function surfaceBlogPath(slug: string): string {
  return `/blog/surfaces/${slug}`;
}
