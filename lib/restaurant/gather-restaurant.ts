import { createLogger } from "@/lib/logger";

import { assembleRestaurantCard } from "./assemble-card";
import { buildRestaurantAddress } from "./build-address";
import { buildRestaurantHours } from "./build-hours";
import { buildRestaurantPhotos } from "./build-photos";
import { buildRestaurantRating } from "./build-rating";
import { buildRestaurantSummary } from "./build-summary";
import { fetchRestaurantMenu } from "./fetch-menu";
import { searchAndGatherVenue } from "./gather-venue";
import type { GatherRestaurantInput, GatherRestaurantResult } from "./types";

const logger = createLogger("lib/restaurant/gather-restaurant.ts");

export async function gatherRestaurant(
  userId: string,
  input: GatherRestaurantInput
): Promise<GatherRestaurantResult> {
  const venueResult = await searchAndGatherVenue(userId, input);

  if (!venueResult.ok) {
    if (venueResult.kind === "ambiguous") {
      return { status: "ambiguous", candidates: venueResult.candidates };
    }

    if (venueResult.kind === "not_found") {
      return { status: "error", error: `Could not find "${input.name}"` };
    }

    return { status: "error", error: venueResult.error };
  }

  const bundle = venueResult.bundle;
  const name = bundle.displayName?.text?.trim() || input.name.trim();

  const [photosPatch, menuResult] = await Promise.all([
    buildRestaurantPhotos(userId, bundle, name),
    fetchRestaurantMenu(bundle.websiteUri),
  ]);

  if (!photosPatch.heroImage) {
    logger.log("gatherRestaurant", "no photos available", { event: "restaurant_no_photos" });

    return {
      status: "error",
      error: "Could not load photos for this venue",
    };
  }

  const addressPatch = buildRestaurantAddress(bundle);
  const summaryPatch = buildRestaurantSummary(bundle);
  const rating = buildRestaurantRating(bundle);
  const hours = buildRestaurantHours(bundle);

  const block = assembleRestaurantCard({
    name,
    heroImage: photosPatch.heroImage,
    gallery: photosPatch.gallery,
    ...addressPatch,
    ...summaryPatch,
    rating,
    hours,
    menu: menuResult.ok ? menuResult.menu : undefined,
  });

  logger.log("gatherRestaurant", "card assembled", {
    event: "restaurant_gathered",
    placeId: bundle.placeId,
    hasMenu: Boolean(block.menu),
    hasHours: Boolean(block.hours),
  });

  return { status: "resolved", block };
}
