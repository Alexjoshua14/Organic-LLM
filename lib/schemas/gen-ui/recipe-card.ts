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

export const RecipeCardBlockSchema = z.object({
  type: z.literal("recipe-card"),
  version: GEN_UI_VERSION,
  title: z.string().min(1),
  sourceUrl: httpUrl().optional().catch(undefined),
  servings: optionalStringCatch(),
  prepTime: optionalStringCatch(),
  cookTime: optionalStringCatch(),
  ingredients: z.array(RecipeIngredientSchema).min(1).max(60),
  steps: z.array(z.string().min(1)).min(1).max(40),
  notes: optionalStringCatch(),
});

export type RecipeCardBlock = z.infer<typeof RecipeCardBlockSchema>;

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
    block.prepTime ? `Prep ${block.prepTime}` : null,
    block.cookTime ? `Cook ${block.cookTime}` : null,
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
