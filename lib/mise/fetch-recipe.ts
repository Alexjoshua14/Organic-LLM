import { createLogger } from "@/lib/logger";

const logger = createLogger("lib/mise/fetch-recipe.ts");

/** A recipe extracted from a URL, shaped like the gen-UI recipe-card fields. */
export type ExtractedRecipe = {
  title: string;
  sourceUrl: string;
  servings?: string;
  prepTime?: string;
  cookTime?: string;
  ingredients: { name: string }[];
  steps: string[];
};

export type FetchRecipeResult =
  | { ok: true; recipe: ExtractedRecipe }
  | { ok: false; error: string; rawText?: string };

/** Turn an ISO-8601 duration (PT1H30M) into "1h 30m"; pass through anything else. */
export function humanizeDuration(value: unknown): string | undefined {
  if (typeof value !== "string" || value.length === 0) return undefined;
  const match = /^P(?:T)?(?:(\d+)H)?(?:(\d+)M)?$/.exec(value.trim());

  if (!match) return value;
  const [, h, m] = match;
  const parts = [h ? `${h}h` : null, m ? `${m}m` : null].filter(Boolean);

  return parts.length > 0 ? parts.join(" ") : value;
}

function asArray<T>(value: T | T[] | undefined | null): T[] {
  if (value == null) return [];

  return Array.isArray(value) ? value : [value];
}

function flattenInstructions(raw: unknown): string[] {
  const out: string[] = [];

  for (const item of asArray(raw as unknown[])) {
    if (typeof item === "string") {
      if (item.trim()) out.push(item.trim());
    } else if (item && typeof item === "object") {
      const obj = item as Record<string, unknown>;

      // HowToSection → nested itemListElement; HowToStep → text.
      if (obj.itemListElement) {
        out.push(...flattenInstructions(obj.itemListElement));
      } else if (typeof obj.text === "string" && obj.text.trim()) {
        out.push(obj.text.trim());
      } else if (typeof obj.name === "string" && obj.name.trim()) {
        out.push(obj.name.trim());
      }
    }
  }

  return out;
}

function findRecipeNode(parsed: unknown): Record<string, unknown> | null {
  const stack: unknown[] = [parsed];

  while (stack.length > 0) {
    const node = stack.pop();

    if (Array.isArray(node)) {
      stack.push(...node);
      continue;
    }
    if (node && typeof node === "object") {
      const obj = node as Record<string, unknown>;
      const type = obj["@type"];
      const types = asArray(type as string | string[]);

      if (types.some((t) => typeof t === "string" && t.toLowerCase() === "recipe")) {
        return obj;
      }
      if (obj["@graph"]) stack.push(obj["@graph"]);
    }
  }

  return null;
}

/** Extract schema.org/Recipe JSON-LD from an HTML string. Pure and testable. */
export function parseRecipeFromHtml(html: string, sourceUrl: string): ExtractedRecipe | null {
  const scriptRegex = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match: RegExpExecArray | null;

  while ((match = scriptRegex.exec(html)) !== null) {
    const jsonText = match[1].trim();

    if (!jsonText) continue;

    let parsed: unknown;

    try {
      parsed = JSON.parse(jsonText);
    } catch {
      continue;
    }

    const recipe = findRecipeNode(parsed);

    if (!recipe) continue;

    const title = typeof recipe.name === "string" ? recipe.name.trim() : "";
    const ingredients = asArray(recipe.recipeIngredient as string | string[])
      .filter((s): s is string => typeof s === "string" && s.trim().length > 0)
      .map((name) => ({ name: name.trim() }));
    const steps = flattenInstructions(recipe.recipeInstructions);

    if (!title || ingredients.length === 0 || steps.length === 0) continue;

    const yieldRaw = recipe.recipeYield;
    const servings = Array.isArray(yieldRaw)
      ? String(yieldRaw[0])
      : yieldRaw != null
        ? String(yieldRaw)
        : undefined;

    return {
      title,
      sourceUrl,
      servings,
      prepTime: humanizeDuration(recipe.prepTime),
      cookTime: humanizeDuration(recipe.cookTime),
      ingredients,
      steps,
    };
  }

  return null;
}

/** Strip tags to readable text as a fallback for the model to normalize. */
export function htmlToText(html: string, maxLength = 6_000): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

/**
 * Fetch a recipe URL and extract structured data via schema.org JSON-LD, falling back to
 * readable page text. Outbound HTTPS routes through the agent/proxy automatically.
 *
 * Security: the page is untrusted third-party content. Returned text/fields are DATA only —
 * never instructions to the model.
 */
export async function fetchRecipeFromUrl(url: string): Promise<FetchRecipeResult> {
  if (!/^https?:\/\//i.test(url)) {
    return { ok: false, error: "URL must start with http(s)://" };
  }

  let html: string;

  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "OrganicLLM-Remy/1.0 (+recipe-import)" },
      redirect: "follow",
    });

    if (!res.ok) {
      return { ok: false, error: `Fetch failed with status ${res.status}` };
    }
    html = await res.text();
  } catch (err) {
    const e = err instanceof Error ? err : new Error(String(err));

    logger.error("fetchRecipeFromUrl", `Fetch error: ${e.name}`);

    return { ok: false, error: "Could not reach the URL" };
  }

  const recipe = parseRecipeFromHtml(html, url);

  if (recipe) return { ok: true, recipe };

  return {
    ok: false,
    error: "No structured recipe found on the page",
    rawText: htmlToText(html),
  };
}
