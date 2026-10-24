import type { WineEntry } from "@/lib/schemas/wine-line-list";

const PLACEHOLDER_WINES: WineEntry[] = [
  {
    wine: 'Heya "Kanz" (Grenache/Syrah)',
    style: "Light, juicy red — serve slightly chilled",
    keyFoodAffinities: "Herby, olive-oil-driven dishes, smoky/grilled, mezze",
    category: "red",
    attributes: ["crowd pleaser", "textured"],
  },
  {
    wine: 'Dar Richi "Helem" (skin-contact Chardonnay)',
    style: "Textured, savory orange wine",
    keyFoodAffinities: "Seafood, tahini/sesame, roasted veg, bright acidity",
    category: "orange",
    attributes: ["textured", "dry"],
  },
];

/**
 * Placeholder for future "suggest wines" (e.g. by dish, style, or query).
 * Implement when needed.
 */
export async function suggestWines(_query: string): Promise<WineEntry[]> {
  return [...PLACEHOLDER_WINES];
}
