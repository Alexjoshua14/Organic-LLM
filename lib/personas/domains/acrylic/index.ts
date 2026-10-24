import type { PersonaStarterId } from "@/lib/personas/unified/session";

import { ACRYLIC_FACTS } from "./facts";
import { ACRYLIC_PRACTICE } from "./knowledge";
import { ROAD_TO_FIRE_REFERENCE } from "./reference-road-to-fire";
import {
  MIX_RECIPES,
  STUDIO_PAINTS,
  STUDIO_SURFACES,
  STUDIO_TOOLS,
  formatMixParts,
  studioLocalSupplyNote,
} from "./studio";

/** Reference material each starter brings into the prompt. */
const STARTER_REFERENCES: Partial<Record<PersonaStarterId, string>> = {
  "sci-fi-cinema-eclipse": ROAD_TO_FIRE_REFERENCE,
};

/** Everything the acrylic domain contributes to the persona prompt. */
export function buildAcrylicDomainKnowledge(options: {
  starterId: PersonaStarterId | null;
}): string {
  const localSupply = studioLocalSupplyNote();
  const reference = options.starterId ? STARTER_REFERENCES[options.starterId] : undefined;

  return [
    `EXPERT DOMAIN — acrylic painting`,
    `THE ARTIST'S STUDIO (assume they have exactly this; they can correct it)
Paints:
${STUDIO_PAINTS.map((paint) => `- ${paint.name} — ${paint.brand}. Pigments: ${paint.pigments}. ${paint.handling}`).join("\n")}
Surfaces (they work on one of these; ask which only if it changes the answer):
${STUDIO_SURFACES.map((surface) => `- ${surface.name}: ${surface.notes}`).join("\n")}
Tools:
${STUDIO_TOOLS.map((tool) => `- ${tool.name}: ${tool.notes}`).join("\n")}
Buying more: an order arrives the next day at the earliest. ${
      localSupply
        ? `Same day, during business hours: ${localSupply}`
        : "A local art store may be an option during business hours; the user knows which."
    } Never state a store's current stock or hours as fact — suggest checking or calling ahead.`,
    `STARTING MIX RECIPES (by volume of wet paint before water or medium; percentages sum to 100; confirm with a dry test swatch)
${MIX_RECIPES.map((recipe) => `- ${recipe.name}: ${formatMixParts(recipe.parts)}. Adjust: ${recipe.adjust}`).join("\n")}`,
    ACRYLIC_PRACTICE,
    `SOURCED FACTS (share only when asked or clearly invited, one at a time; give the source if asked; never invent others)
${ACRYLIC_FACTS.map((fact) => `- ${fact.fact} (${fact.source})`).join("\n")}`,
    reference ?? "",
  ]
    .filter(Boolean)
    .join("\n\n");
}
