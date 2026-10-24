import type { ShoppingListBlock } from "@/lib/schemas/gen-ui";
import type { PrepWeekIngredient } from "@/lib/schemas/prep";

const UNCATEGORIZED = "Other";

/**
 * Group weekly prep ingredients into the gen-UI shopping-list block.
 * `identities` is a parallel grid so toggles can map back to `identity`.
 */
export function buildPrepShoppingList(
  ingredients: PrepWeekIngredient[],
  title: string
): { block: ShoppingListBlock; identities: string[][] } {
  const byCategory = new Map<string, PrepWeekIngredient[]>();

  for (const row of ingredients) {
    const cat = row.category?.trim() || UNCATEGORIZED;

    if (!byCategory.has(cat)) byCategory.set(cat, []);
    byCategory.get(cat)!.push(row);
  }

  const entries = [...byCategory.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  const identities: string[][] = [];
  const groups = entries.map(([category, items]) => {
    identities.push(items.map((i) => i.identity));

    return {
      category,
      items: items.map((i) => ({
        name: i.name,
        quantity: i.quantity,
        unit: i.unit,
        status: i.status,
        checked: i.checked,
      })),
    };
  });

  return {
    block: {
      type: "shopping-list",
      version: 1,
      title,
      groups,
    },
    identities,
  };
}
