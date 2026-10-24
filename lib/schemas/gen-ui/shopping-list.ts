import { z } from "zod";

import { GEN_UI_VERSION, optionalStringCatch } from "./shared";

/** Whether the cook already has the item or still needs to buy it. */
export const ShoppingItemStatusSchema = z.enum(["have", "need"]);

export type ShoppingItemStatus = z.infer<typeof ShoppingItemStatusSchema>;

export const ShoppingItemSchema = z.object({
  name: z.string().min(1),
  quantity: optionalStringCatch(),
  unit: optionalStringCatch(),
  status: ShoppingItemStatusSchema.catch("need"),
  /** Whether the user has ticked this off (e.g. picked it up at the store). */
  checked: z.boolean().optional().catch(false),
  /** Which recipe this ingredient is for, when known. */
  recipe: optionalStringCatch(),
});

export type ShoppingItem = z.infer<typeof ShoppingItemSchema>;

export const ShoppingGroupSchema = z.object({
  /** Aisle/category, e.g. "Produce", "Dairy", "Pantry". */
  category: z.string().min(1),
  items: z.array(ShoppingItemSchema).min(1).max(60),
});

export type ShoppingGroup = z.infer<typeof ShoppingGroupSchema>;

export const ShoppingListBlockSchema = z.object({
  type: z.literal("shopping-list"),
  version: GEN_UI_VERSION,
  title: z.string().min(1),
  groups: z.array(ShoppingGroupSchema).min(1).max(15),
});

export type ShoppingListBlock = z.infer<typeof ShoppingListBlockSchema>;

function shoppingItemToText(item: ShoppingItem): string {
  const qty = [item.quantity, item.unit].filter(Boolean).join(" ").trim();
  const base = qty ? `${qty} ${item.name}` : item.name;

  return item.recipe ? `${base} — ${item.recipe}` : base;
}

export function shoppingListToMarkdown(block: ShoppingListBlock): string {
  const lines: string[] = [`## ${block.title}`, ""];

  for (const group of block.groups) {
    lines.push(`### ${group.category}`, "");
    for (const item of group.items) {
      const box = item.checked ? "[x]" : "[ ]";
      const tag = item.status === "have" ? " _(have)_" : "";

      lines.push(`- ${box} ${shoppingItemToText(item)}${tag}`);
    }
    lines.push("");
  }

  return lines.join("\n").trim();
}

/** Best-effort markdown when full parse failed. */
export function shoppingListToMarkdownLoose(raw: Record<string, unknown>): string {
  const title = typeof raw.title === "string" ? raw.title : "Shopping list";

  return `## ${title}\n\n_(Shopping list — structured view unavailable)_`;
}
