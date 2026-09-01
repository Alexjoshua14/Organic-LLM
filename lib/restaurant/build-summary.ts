import type { RestaurantStoreType } from "@/lib/schemas/gen-ui/restaurant-card";

import type { VenueBundle } from "./types";

const PRIMARY_TYPE_TO_STORE: Record<string, RestaurantStoreType> = {
  restaurant: "restaurant",
  cafe: "cafe",
  coffee_shop: "cafe",
  bar: "cocktail_bar",
  wine_bar: "wine_bar",
  bakery: "bakery",
  brewery: "brewery",
  meal_takeaway: "fast_casual",
  fast_food_restaurant: "fast_casual",
  fine_dining_restaurant: "fine_dining",
  brunch_restaurant: "brunch_spot",
  food_truck: "food_truck",
};

export type SummaryPatch = {
  summary?: string;
  storeType?: RestaurantStoreType;
};

export function buildRestaurantSummary(bundle: VenueBundle): SummaryPatch {
  const primaryType = bundle.primaryType?.trim().toLowerCase();
  const mapped = primaryType ? PRIMARY_TYPE_TO_STORE[primaryType] : undefined;
  const storeType: RestaurantStoreType =
    mapped ?? (primaryType?.includes("cafe") ? "cafe" : "restaurant");

  const editorial = bundle.editorialSummary?.text?.trim();
  const typeLabel = bundle.primaryTypeDisplayName?.text?.trim();

  let summary: string | undefined;

  if (editorial) {
    summary = editorial;
  } else if (typeLabel) {
    summary = typeLabel;
  }

  return {
    summary,
    storeType,
  };
}
