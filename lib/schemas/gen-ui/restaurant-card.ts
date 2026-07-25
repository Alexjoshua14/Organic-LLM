import { z } from "zod";

import { GEN_UI_VERSION, httpUrl, optionalStringCatch } from "./shared";

export const RESTAURANT_STORE_TYPES = [
  "restaurant",
  "food_truck",
  "cafe",
  "cocktail_bar",
  "wine_bar",
  "bakery",
  "brewery",
  "fast_casual",
  "fine_dining",
  "brunch_spot",
] as const;

export type RestaurantStoreType = (typeof RESTAURANT_STORE_TYPES)[number];

export const DAY_OF_WEEK = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
] as const;

export type DayOfWeek = (typeof DAY_OF_WEEK)[number];

export const RestaurantReviewSourceSchema = z.object({
  name: z.enum(["yelp", "google", "beli", "other"]),
  rating: z.number().min(0).max(5).optional().catch(undefined),
  reviewCount: z.number().int().nonnegative().optional().catch(undefined),
});

export type RestaurantReviewSource = z.infer<typeof RestaurantReviewSourceSchema>;

export const RestaurantRatingSchema = z.object({
  average: z.number().min(0).max(5),
  reviewCount: z.number().int().nonnegative(),
  sources: z.array(RestaurantReviewSourceSchema).max(5).optional().catch([]),
});

export type RestaurantRating = z.infer<typeof RestaurantRatingSchema>;

export const RestaurantImageSchema = z.object({
  url: httpUrl(),
  alt: optionalStringCatch(),
  kind: z
    .enum(["exterior", "interior", "food", "vibe", "other"])
    .optional()
    .catch(undefined),
});

export type RestaurantImage = z.infer<typeof RestaurantImageSchema>;

export const RestaurantHoursDaySchema = z.object({
  day: z.enum(DAY_OF_WEEK),
  open: optionalStringCatch(),
  close: optionalStringCatch(),
  closed: z.boolean().optional().catch(false),
  note: optionalStringCatch(),
});

export type RestaurantHoursDay = z.infer<typeof RestaurantHoursDaySchema>;

export const RestaurantHolidayHoursSchema = z.object({
  date: z.string().min(1),
  label: z.string().min(1),
  closed: z.boolean().optional().catch(false),
  hours: optionalStringCatch(),
});

export type RestaurantHolidayHours = z.infer<typeof RestaurantHolidayHoursSchema>;

export const RestaurantHoursSchema = z.object({
  regular: z.array(RestaurantHoursDaySchema).min(1).max(7),
  kitchen: z.array(RestaurantHoursDaySchema).max(7).optional(),
  holidayOverrides: z.array(RestaurantHolidayHoursSchema).max(20).optional(),
  timezone: optionalStringCatch(),
});

export type RestaurantHours = z.infer<typeof RestaurantHoursSchema>;

export const MenuItemSchema = z.object({
  name: z.string().min(1),
  description: optionalStringCatch(),
  price: optionalStringCatch(),
  dietaryTags: z.array(z.string().max(32)).max(6).optional().catch([]),
});

export type MenuItem = z.infer<typeof MenuItemSchema>;

export const MenuSectionSchema = z.object({
  name: z.string().min(1),
  items: z.array(MenuItemSchema).min(1).max(40),
});

export type MenuSection = z.infer<typeof MenuSectionSchema>;

export const RestaurantMenuSchema = z.object({
  /** ISO date (YYYY-MM-DD) when the restaurant last published this menu. */
  lastUpdated: z.string().min(1),
  sourceNote: optionalStringCatch(),
  sections: z.array(MenuSectionSchema).min(1).max(20),
});

export type RestaurantMenu = z.infer<typeof RestaurantMenuSchema>;

export const PopularTimesBarSchema = z.object({
  hour: z.number().int().min(0).max(23),
  occupancy: z.number().int().min(0).max(100),
});

export type PopularTimesBar = z.infer<typeof PopularTimesBarSchema>;

export const PopularTimesDaySchema = z.object({
  day: z.enum(DAY_OF_WEEK),
  bars: z.array(PopularTimesBarSchema).min(1).max(24),
});

export type PopularTimesDay = z.infer<typeof PopularTimesDaySchema>;

export const RestaurantLinksSchema = z.object({
  website: httpUrl().optional().catch(undefined),
  yelp: httpUrl().optional().catch(undefined),
  googleMaps: httpUrl().optional().catch(undefined),
  directions: httpUrl().optional().catch(undefined),
});

export type RestaurantLinks = z.infer<typeof RestaurantLinksSchema>;

export const RestaurantCardBlockSchema = z.object({
  type: z.literal("restaurant-card"),
  version: GEN_UI_VERSION,
  name: z.string().min(1),
  storeType: z.enum(RESTAURANT_STORE_TYPES).catch("restaurant"),
  summary: optionalStringCatch(),
  address: optionalStringCatch(),
  phone: optionalStringCatch(),
  rating: RestaurantRatingSchema.optional(),
  heroImage: RestaurantImageSchema,
  gallery: z.array(RestaurantImageSchema).max(12).optional().catch([]),
  hours: RestaurantHoursSchema.optional(),
  menu: RestaurantMenuSchema.optional(),
  popularTimes: z.array(PopularTimesDaySchema).max(7).optional(),
  links: RestaurantLinksSchema.optional(),
});

export type RestaurantCardBlock = z.infer<typeof RestaurantCardBlockSchema>;

const STORE_TYPE_LABELS: Record<RestaurantStoreType, string> = {
  restaurant: "Restaurant",
  food_truck: "Food truck",
  cafe: "Café",
  cocktail_bar: "Cocktail bar",
  wine_bar: "Wine bar",
  bakery: "Bakery",
  brewery: "Brewery",
  fast_casual: "Fast casual",
  fine_dining: "Fine dining",
  brunch_spot: "Brunch spot",
};

export function formatRestaurantStoreType(storeType: RestaurantStoreType): string {
  return STORE_TYPE_LABELS[storeType] ?? "Restaurant";
}

export function restaurantCardToMarkdown(block: RestaurantCardBlock): string {
  const lines: string[] = [`## ${block.name}`, ""];

  lines.push(`_${formatRestaurantStoreType(block.storeType)}_`);

  if (block.rating) {
    lines.push(
      "",
      `**${block.rating.average.toFixed(1)}★** · ${block.rating.reviewCount.toLocaleString()} reviews`
    );
  }

  if (block.summary) lines.push("", block.summary);
  if (block.address) lines.push("", block.address);
  if (block.phone) lines.push("", `Phone: ${block.phone}`);

  if (block.menu) {
    lines.push("", `### Menu (updated ${block.menu.lastUpdated})`, "");
    for (const section of block.menu.sections) {
      lines.push(`#### ${section.name}`, "");
      for (const item of section.items) {
        const price = item.price ? ` — ${item.price}` : "";

        lines.push(`- ${item.name}${price}`);
      }
      lines.push("");
    }
  }

  if (block.links?.website) lines.push("", `[Website](${block.links.website})`);
  if (block.links?.yelp) lines.push(`[Yelp](${block.links.yelp})`);

  return lines.join("\n").trim();
}

export function restaurantCardToMarkdownLoose(raw: Record<string, unknown>): string {
  const name = typeof raw.name === "string" ? raw.name : "Restaurant";

  return `## ${name}\n\n_(Restaurant card — structured view unavailable)_`;
}
