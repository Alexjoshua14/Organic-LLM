import { createLogger } from "@/lib/logger";
import type { MenuSection, RestaurantMenu } from "@/lib/schemas/gen-ui/restaurant-card";

const logger = createLogger("lib/restaurant/fetch-menu.ts");

function asArray<T>(value: T | T[] | undefined | null): T[] {
  if (value == null) return [];

  return Array.isArray(value) ? value : [value];
}

function findMenuNodes(parsed: unknown): Record<string, unknown>[] {
  const menus: Record<string, unknown>[] = [];
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

      if (types.some((t) => typeof t === "string" && t.toLowerCase() === "menu")) {
        menus.push(obj);
      }

      if (obj["@graph"]) stack.push(obj["@graph"]);
      if (obj.hasMenu) stack.push(obj.hasMenu);
    }
  }

  return menus;
}

function parseMenuItem(raw: unknown): { name: string; description?: string; price?: string } | null {
  if (!raw || typeof raw !== "object") return null;

  const obj = raw as Record<string, unknown>;
  const name = typeof obj.name === "string" ? obj.name.trim() : "";

  if (!name) return null;

  const description =
    typeof obj.description === "string" ? obj.description.trim() : undefined;

  let price: string | undefined;

  if (obj.offers && typeof obj.offers === "object") {
    const offers = obj.offers as Record<string, unknown>;
    const priceVal = offers.price ?? offers.lowPrice;

    if (priceVal != null) {
      if (typeof priceVal === "number") {
        price = `$${priceVal}`;
      } else {
        const text = String(priceVal).trim();
        price = text.startsWith("$") ? text : `$${text}`;
      }
    }
  }

  return { name, description, price };
}

function parseMenuSection(raw: unknown): MenuSection | null {
  if (!raw || typeof raw !== "object") return null;

  const obj = raw as Record<string, unknown>;
  const sectionName =
    typeof obj.name === "string"
      ? obj.name.trim()
      : typeof obj.description === "string"
        ? obj.description.trim()
        : "Menu";

  const items = asArray(obj.hasMenuItem ?? obj.menuItem)
    .map(parseMenuItem)
    .filter((item): item is NonNullable<typeof item> => item != null);

  if (items.length === 0) return null;

  return { name: sectionName, items };
}

/** Extract schema.org Menu JSON-LD from HTML. Pure and testable. */
export function parseMenuFromHtml(html: string): RestaurantMenu | null {
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

    const menuNodes = findMenuNodes(parsed);

    for (const menuNode of menuNodes) {
      const sections = asArray(menuNode.hasMenuSection)
        .map(parseMenuSection)
        .filter((s): s is MenuSection => s != null);

      if (sections.length === 0) continue;

      const today = new Date().toISOString().slice(0, 10);

      return {
        lastUpdated: today,
        sourceNote: "From restaurant website",
        sections,
      };
    }
  }

  return null;
}

export type FetchMenuResult =
  | { ok: true; menu: RestaurantMenu }
  | { ok: false; error: string };

/**
 * Fetch menu from the restaurant website. Returns undefined-equivalent on failure —
 * callers should omit menu from the card.
 */
export async function fetchRestaurantMenu(websiteUrl: string | undefined): Promise<FetchMenuResult> {
  if (!websiteUrl?.trim() || !/^https?:\/\//i.test(websiteUrl)) {
    return { ok: false, error: "No website URL" };
  }

  try {
    const res = await fetch(websiteUrl, {
      headers: { "User-Agent": "OrganicLLM-Restaurant/1.0 (+menu-import)" },
      redirect: "follow",
    });

    if (!res.ok) {
      return { ok: false, error: `Fetch failed with status ${res.status}` };
    }

    const html = await res.text();
    const menu = parseMenuFromHtml(html);

    if (!menu) {
      return { ok: false, error: "No structured menu found on the page" };
    }

    return { ok: true, menu };
  } catch (err) {
    const e = err instanceof Error ? err : new Error(String(err));

    logger.error("fetchRestaurantMenu", `Fetch error: ${e.name}`);

    return { ok: false, error: "Could not reach the website" };
  }
}
