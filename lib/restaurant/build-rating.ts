import type { RestaurantRating } from "@/lib/schemas/gen-ui/restaurant-card";

import type { VenueBundle } from "./types";

export function buildRestaurantRating(bundle: VenueBundle): RestaurantRating | undefined {
  const rating = bundle.rating;
  const reviewCount = bundle.userRatingCount;

  if (rating == null || reviewCount == null || reviewCount <= 0) {
    return undefined;
  }

  return {
    average: Math.round(rating * 10) / 10,
    reviewCount,
    sources: [{ name: "google", rating: Math.round(rating * 10) / 10, reviewCount }],
  };
}
