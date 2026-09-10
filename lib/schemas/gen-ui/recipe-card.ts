import { z } from "zod";

import { GEN_UI_VERSION, httpUrl, optionalStringCatch } from "./shared";

/** A single recipe ingredient line. Quantity/unit are free-form to keep import lossless. */
export const RecipeIngredientSchema = z.object({
  name: z.string().min(1),
  quantity: optionalStringCatch(),
  unit: optionalStringCatch(),
  note: optionalStringCatch(),
});

export type RecipeIngredient = z.infer<typeof RecipeIngredientSchema>;

export const RECIPE_COMPLEXITIES = ["easy", "medium", "hard"] as const;
export const RecipeComplexitySchema = z.enum(RECIPE_COMPLEXITIES);
export type RecipeComplexity = z.infer<typeof RecipeComplexitySchema>;

/**
 * Shared recipe-card body: everything except gen-UI `{ type, version }` and mise `{ id }`.
 * New glance/library fields are optional so existing cards still parse.
 */
export const RecipeCardBodySchema = z.object({
  title: z.string().min(1),
  sourceUrl: httpUrl().optional().catch(undefined),
  servings: optionalStringCatch(),
  prepTime: optionalStringCatch(),
  cookTime: optionalStringCatch(),
  duration: optionalStringCatch(),
  complexity: RecipeComplexitySchema.optional().catch(undefined),
  mainProtein: optionalStringCatch(),
  mainCarbs: optionalStringCatch(),
  cuisine: optionalStringCatch(),
  equipment: z.array(z.string().min(1)).max(20).optional().catch(undefined),
  ingredients: z.array(RecipeIngredientSchema).min(1).max(60),
  steps: z.array(z.string().min(1)).min(1).max(40),
  notes: optionalStringCatch(),
});

export type RecipeCardBody = z.infer<typeof RecipeCardBodySchema>;

export const RecipeCardBlockSchema = RecipeCardBodySchema.extend({
  type: z.literal("recipe-card"),
  version: GEN_UI_VERSION,
});

export type RecipeCardBlock = z.infer<typeof RecipeCardBlockSchema>;

export const RECIPE_COMPLEXITY_LABEL: Record<RecipeComplexity, string> = {
  easy: "Easy",
  medium: "Medium",
  hard: "Hard",
};

/** Render an ingredient as "1 cup flour (sifted)". */
export function recipeIngredientToText(ing: RecipeIngredient): string {
  const qty = [ing.quantity, ing.unit].filter(Boolean).join(" ").trim();
  const base = qty ? `${qty} ${ing.name}` : ing.name;

  return ing.note ? `${base} (${ing.note})` : base;
}

export function recipeCardToMarkdown(block: RecipeCardBlock): string {
  const lines: string[] = [`## ${block.title}`, ""];

  const meta = [
    block.servings ? `Serves ${block.servings}` : null,
    block.complexity ? RECIPE_COMPLEXITY_LABEL[block.complexity] : null,
    block.duration ? `Total ${block.duration}` : null,
    block.prepTime ? `Prep ${block.prepTime}` : null,
    block.cookTime ? `Cook ${block.cookTime}` : null,
    block.mainProtein ? `Protein ${block.mainProtein}` : null,
    block.mainCarbs ? `Carbs ${block.mainCarbs}` : null,
    block.cuisine ? block.cuisine : null,
    block.equipment?.length ? block.equipment.join(", ") : null,
  ].filter(Boolean);

  if (meta.length > 0) lines.push(`_${meta.join(" · ")}_`, "");

  lines.push("### Ingredients", "");
  for (const ing of block.ingredients) {
    lines.push(`- ${recipeIngredientToText(ing)}`);
  }
  lines.push("");

  lines.push("### Steps", "");
  block.steps.forEach((step, i) => {
    lines.push(`${i + 1}. ${step}`);
  });

  if (block.notes) lines.push("", `> ${block.notes}`);
  if (block.sourceUrl) lines.push("", `Source: ${block.sourceUrl}`);

  return lines.join("\n").trim();
}

/** Best-effort markdown when full parse failed. */
export function recipeCardToMarkdownLoose(raw: Record<string, unknown>): string {
  const title = typeof raw.title === "string" ? raw.title : "Recipe";

  return `## ${title}\n\n_(Recipe card — structured view unavailable)_`;
}
