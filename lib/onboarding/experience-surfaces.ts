/** Surfaces in the experience rail + blog docs. Chat variants will merge into Chat soon. */
export type ExperienceSurface = {
  id: string;
  /** URL segment under `/blog/surfaces/` */
  slug: string;
  label: string;
  description: string;
  tryHref: string;
  /** Grouped under Chat in docs until variants collapse into one composer. */
  chatVariant?: boolean;
};

export const CHAT_VARIANT_NOTE =
  "Arcadia and Noesis are chat experiences today — separate rails for now, one Chat surface soon.";

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
    description: "Fast, tool-forward chat when you want concise answers.",
    tryHref: "/sandbox/arcadia",
    chatVariant: true,
  },
  {
    id: "noesis",
    slug: "noesis",
    label: "Noesis",
    description: "Explore a topic with sparks and reply suggestions.",
    tryHref: "/sandbox/topic-explore",
    chatVariant: true,
  },
  {
    id: "strata",
    slug: "strata",
    label: "Strata",
    description: "Rough notes → structured sections on an editorial canvas.",
    tryHref: "/sandbox/prototypes/strata",
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
    description: "Durable todos — keyboard-first task list.",
    tryHref: "/ergon",
  },
  {
    id: "remy",
    slug: "remy",
    label: "Remy",
    description: "Threads with the Remy assistant.",
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
