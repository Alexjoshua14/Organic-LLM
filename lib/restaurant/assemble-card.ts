import type { RestaurantCardBlock } from "@/lib/schemas/gen-ui/restaurant-card";

import type { RestaurantCardPatch } from "./types";

export function assembleRestaurantCard(
  patch: RestaurantCardPatch & { name: string; heroImage: RestaurantCardBlock["heroImage"] }
): RestaurantCardBlock {
  return {
    type: "restaurant-card",
    version: 1,
    name: patch.name,
    storeType: patch.storeType ?? "restaurant",
    summary: patch.summary,
    address: patch.address,
    phone: patch.phone,
    rating: patch.rating,
    heroImage: patch.heroImage,
    gallery: patch.gallery ?? [],
    hours: patch.hours,
    menu: patch.menu,
    links: patch.links,
  };
}
