import type { RecipeIngredient } from "@/lib/schemas/gen-ui/recipe-card";
import type { PrepWeekIngredient } from "@/lib/schemas/prep";

import { PrepWeekIngredientSchema } from "@/lib/schemas/prep";

const IDENTITY_SEP = "|";

function normalizeToken(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

/** Stable merge key: normalized name + unit (empty unit is still a distinct key). */
export function ingredientIdentity(name: string, unit?: string | null): string {
  return `${normalizeToken(name)}${IDENTITY_SEP}${normalizeToken(unit ?? "")}`;
}

/**
 * Leading number, mixed number, or simple fraction from a free-form quantity.
 * Returns null when nothing numeric can be read.
 */
export function parseQuantity(quantity?: string | null): number | null {
  if (!quantity) return null;

  const t = quantity.trim();
  const mixed = t.match(/^(\d+)\s+(\d+)\s*\/\s*(\d+)/);

  if (mixed) return Number(mixed[1]) + Number(mixed[2]) / Number(mixed[3]);

  const frac = t.match(/^(\d+)\s*\/\s*(\d+)/);

  if (frac) return Number(frac[1]) / Number(frac[2]);

  const n = t.match(/^-?\d+(?:\.\d+)?/);

  return n ? Number(n[0]) : null;
}

export function formatQuantity(n: number): string {
  if (Number.isInteger(n)) return String(n);

  const rounded = Math.round(n * 1000) / 1000;

  return String(rounded);
}

/**
 * How many batches this cook placement contributes.
 * Card quantities are already sized to `servings`; one cook slot = one batch.
 * A leading number in `servings` is recorded only as documentation on the card,
 * not as a multiplier (e.g. "16 small squares" must not 16× the flour).
 */
export function cookBatchCount(_servings?: string | null): number {
  return 1;
}

export type CookPlacementForShopping = {
  leftoverOfPlacementId?: string | null;
  servings?: string | null;
  ingredients: RecipeIngredient[];
};

export type PreviousWeekIngredient = Pick<
  PrepWeekIngredient,
  "identity" | "status" | "checked" | "category"
>;

/**
 * Recompute weekly shopping from cook placements only.
 *
 * - Ignore leftover-of rows (`leftoverOfPlacementId` set).
 * - Each cook placement contributes one batch of the card's listed quantities
 *   (already scaled to that recipe's `servings`).
 * - Merge by normalized name+unit; sum numeric quantities.
 * - Carry have/need/checked (and category if the new row has none) when identity matches.
 */
export function aggregateWeekIngredients(
  placements: CookPlacementForShopping[],
  previous: PreviousWeekIngredient[] = []
): PrepWeekIngredient[] {
  const prior = new Map(previous.map((row) => [row.identity, row]));
  const merged = new Map<
    string,
    {
      name: string;
      unit?: string;
      numeric: number;
      numericCount: number;
      textQuantities: string[];
    }
  >();

  for (const placement of placements) {
    if (placement.leftoverOfPlacementId) continue;

    const batches = cookBatchCount(placement.servings);

    for (const ing of placement.ingredients) {
      const identity = ingredientIdentity(ing.name, ing.unit);
      const existing = merged.get(identity);
      const qty = parseQuantity(ing.quantity);
      const scaled = qty === null ? null : qty * batches;
      const textQty =
        scaled === null && ing.quantity
          ? batches > 1
            ? `${ing.quantity} × ${batches}`
            : ing.quantity
          : undefined;

      if (!existing) {
        merged.set(identity, {
          name: ing.name.trim(),
          unit: ing.unit?.trim() || undefined,
          numeric: scaled ?? 0,
          numericCount: scaled === null ? 0 : 1,
          textQuantities: textQty ? [textQty] : [],
        });
        continue;
      }

      if (scaled !== null) {
        existing.numeric += scaled;
        existing.numericCount += 1;
      } else if (textQty && !existing.textQuantities.includes(textQty)) {
        existing.textQuantities.push(textQty);
      }
    }
  }

  const rows: PrepWeekIngredient[] = [];

  for (const [identity, bucket] of merged) {
    const priorRow = prior.get(identity);
    let quantity: string | undefined;

    if (bucket.numericCount > 0) {
      quantity = formatQuantity(bucket.numeric);
      if (bucket.textQuantities.length > 0) {
        quantity = `${quantity} + ${bucket.textQuantities.join(" + ")}`;
      }
    } else if (bucket.textQuantities.length > 0) {
      quantity = bucket.textQuantities.join(" + ");
    }

    rows.push(
      PrepWeekIngredientSchema.parse({
        identity,
        name: bucket.name,
        quantity,
        unit: bucket.unit,
        category: priorRow?.category,
        status: priorRow?.status ?? "need",
        checked: priorRow?.checked ?? false,
      })
    );
  }

  rows.sort((a, b) => a.identity.localeCompare(b.identity));

  return rows;
}
