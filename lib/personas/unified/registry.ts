import type { PersonaDomainId, PersonaId, PersonaStarterId } from "./session";

/**
 * Personas and their expert domains. v0 has one persona with one domain; the shapes are what a
 * hot-swappable domain (charcoal, pencil, Blender, creative coding in Rust) plugs into later:
 * a domain owns its knowledge, studio kit, starters and work-state reducer.
 */

export type PersonaDefinition = {
  id: PersonaId;
  name: string;
  tagline: string;
  domains: readonly PersonaDomainId[];
  defaultDomain: PersonaDomainId;
};

export const PERSONAS: Readonly<Record<PersonaId, PersonaDefinition>> = {
  "artist-assistant": {
    id: "artist-assistant",
    name: "Artist assistant",
    tagline: "Acrylic painting — your palette, your direction",
    domains: ["acrylic-painting"],
    defaultDomain: "acrylic-painting",
  },
};

export type PersonaStarter = {
  id: PersonaStarterId;
  domainId: PersonaDomainId;
  label: string;
  blurb: string;
  /** Becomes the session subject when the starter is chosen. */
  subject: string;
};

export const PERSONA_STARTERS: readonly PersonaStarter[] = [
  {
    id: "sci-fi-cinema-eclipse",
    domainId: "acrylic-painting",
    label: "Sci-fi cinema eclipse",
    blurb:
      "After John Harris's The Road to Fire — raw umber, titanium white, a hint of Grumbacher Red.",
    subject:
      'A cinematic sci-fi eclipse inspired by John Harris\'s "The Road to Fire". Predominantly raw umber and titanium white, with a hint of Grumbacher Red. Tools: palette knife, a felt-head brush about 1/3 in wide, and two small round brushes (small and smaller).',
  },
];

export function findPersonaStarter(id: PersonaStarterId | null | undefined): PersonaStarter | null {
  return PERSONA_STARTERS.find((starter) => starter.id === id) ?? null;
}
